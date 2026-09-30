# ADR 0018 — Server-Side Query, Pagination, Sorting, dan Filtering pada Seluruh API

**Status:** diterima  
**Tanggal:** 2026-09-30  
**Memperbarui:** ADR 0016 (pengecualian query untuk filter/pagination), ADR 0017 (struktur views & API)

## Konteks

Seiring bertambahnya volume data transaksi, invoice, log aktivitas, dan entitas pengguna, pengambilan seluruh data ke sisi browser (*client-side fetch-all*) lalu melakukan filtering/sorting/slicing di frontend menyebabkan:
1. Penurunan performa transfer data dan pemborosan bandwidth jaringan.
2. Tingginya beban memori browser client dan latency render.
3. Ketiadaan efisiensi dari database index yang telah dioptimasi di PostgreSQL (Composite B-Tree & Partial Index).
4. Risiko inkonsistensi status dan paginasi data ketika data bertambah secara dinamis.

## Keputusan

1. **Wajib Server-Side Query**: Semua API daftar data (`GET /admin/invoices`, `GET /admin/users`, `GET /admin/jobs`, `GET /customer/invoices`, `GET /customer/generated-lists`, `GET /admin/audit-logs`, dll.) **WAJIB** mengeksekusi paginasi (`page`, `limit`), penyaringan (`status`, `q`, filter lain), dan pengurutan (`sortBy`, `sortOrder`) secara server-side pada query layer database (Prisma / SQL `WHERE`, `ORDER BY`, `LIMIT`, `OFFSET`).
2. **Dilarang Client-Side Slicing**: Frontend (`apps/web`) **DILARANG** mengambil seluruh data lalu memfilter (`.filter(...)`), mengurutkan (`.sort(...)`), atau memotong halaman (`.slice(...)`) di memori JavaScript browser untuk menampilkan tabel/list.
3. **Standar Kontrak Query Parameter & Respon**:
   - Parameter Query Request:
     - `page`: nomor halaman (1-indexed, integer, default: `1`).
     - `limit`: jumlah per halaman (`10`, `20`, `50`, `100`, default: `10`, max: `100`).
     - `status`: filter status entitas (misal `all`, `kurasi`, `pending`, `paid`, `expired`, `canceled`).
     - `sortBy`: kolom pengurutan (misal `createdAt`, `amountIdr`, `points`, `status`).
     - `sortOrder`: arah pengurutan (`asc` | `desc`, default: `desc`).
     - `q`: kata kunci pencarian teks (case-insensitive `contains` pada kolom indeks).
   - Format Respon Metadata Paginasi:
     ```json
     {
       "items": [...],
       "pagination": {
         "page": 1,
         "limit": 10,
         "total": 42,
         "totalPages": 5,
         "hasNext": true,
         "hasPrev": false
       }
     }
     ```
4. **Sinkronisasi URL & Next.js App Router**:
   - Perubahan halaman, limit, filter, sort, dan search di UI admin/dashboard wajib memperbarui query URL (`router.push('/path?status=...&page=...&limit=...')`) sehingga SSR / Server Components dapat langsung meneruskan query parameter ke backend via `searchParams`.
5. **Dukungan Indeks Database PostgreSQL**:
   - Seluruh kolom yang menjadi target `WHERE` dan `ORDER BY` wajib didukung oleh Composite B-Tree Index pada `prisma/schema.prisma` (misal `@@index([status, createdAt])`, `@@index([userId, createdAt])`, `@@index([paymentMethod, status])`, dll.).

## Konsekuensi

- Waktu respon API dan load halaman tetap konstan (*O(1)* per page) terlepas dari apakah database memiliki ribuan atau jutaan baris data.
- Frontend menjadi lebih ramping, stateless, dan mudah di-bookmark / di-share URL-nya dengan status filter dan halaman yang tepat.
- Agen AI maupun pengembang dilarang memindahkan pagination/sorting kembali ke frontend.
