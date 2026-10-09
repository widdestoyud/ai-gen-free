# Claude — ikuti repo ini

Baca **`AGENTS.md`** di root sebelum menulis kode. File ini hanya pointer.

Kunci:

- Next.js = UI. API Fastify. Worker BullMQ. Prisma hanya di API/worker/packages.
- Sesi browser = NextAuth (`apps/web`). OTP + satu sesi = `apps/api`. Bukan Firebase, bukan JWT di `localStorage`.
- UI = Mantine. Dilarang `style={{ … }}`. Komponen di `apps/web/components/`, helper di `apps/web/lib/`.
- Jangan percaya `cost`/`role`/`balance` dari klien. Jangan potong poin dari UI.
- Payload aksi hanya JSON body, bukan query param (ADR 0016).
- Postman = tepat 1 koleksi (`ai-gen-free.postman_collection.json`) & 1 environment (`local.postman_environment.json`).
- Endpoint browser publik DILARANG mengekspos nama model upstream / provider (hanya ID abstrak seperti `t2i-standard`, `video-standard`, dsb.).
- Seluruh query daftar data WAJIB server-side pagination, sorting, & filtering (ADR 0018).
- Frontend Next.js DILARANG refetch/polling API menggunakan interval (`refetchInterval` / `setInterval`); wajib event-driven via SSE (`/api/invoices/events`) & invalidasi cache on-demand.
- Setiap integrasi model/provider baru di `packages/providers-*` WAJIB mengonversi payload aspect ratio mengacu pada referensi kanonik `apps/web/lib/aspect-ratio.ts` (tidak boleh fallback ke 1024x1024 saat rasio non-square dipilih).
- Request probing/testing langsung ke upstream provider WAJIB memakai prefix prompt standar `[TEST:DEV]` / `[TEST:QA]`.
- ADR di `docs/adr/` terkunci; perubahan = ADR baru.
- SDLC: `aidlc/README.md`. Orchestrator tidak menulis kode produk.

Scoped: `apps/web/AGENTS.md`, `apps/api/AGENTS.md`.
