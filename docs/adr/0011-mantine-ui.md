# ADR 0011 — UI kit Mantine, tanpa style inline

**Status:** diterima  
**Tanggal:** 2026-09-05

## Konteks

Halaman `apps/web` memakai objek `style={{ … }}` di setiap page. Itu tidak reusable, sulit dijaga, dan mendorong agen menyalin warna hex.

## Keputusan

- Kit UI v1: **Mantine 8** (`@mantine/core`, `@mantine/hooks`) — cocok dengan Next.js 15. Jangan lompat ke Mantine 9 sebelum Next/React mengekspor `Activity`.
- Dilarang `style={{ … }}` (inline style object) di presentation.
- Item berulang (kartu invoice, kartu job, baris inbox, alert error, shell halaman, tautan dalam app) adalah **komponen** di `apps/web/components/`.
- Utilitas fetch/error/format tanggal-rupiah di `apps/web/lib/`.
- Bahasa UI tetap Indonesia.
- Warna/spacing lewat props Mantine (`c`, `mt`, `fw`, `variant`) atau CSS module / `classNames`. Bukan hex tersebar di JSX.

## Bukan keputusan ini

- Tailwind sebagai sistem utama.
- styled-components / Emotion `sx` sebagai gaya default.
- Design system terpisah di luar Mantine.

## Alasan

- Komponen siap pakai (form, alert, paper, image) tanpa CSS-in-JS di App Router.
- Satu sumber untuk agen FE: jangan mengarang tombol baru dari inline style.

## Konsekuensi

- `MantineProvider` + `ColorSchemeScript` di root layout. Default scheme: dark.
- Agen yang menambah layar wajib memakai komponen yang ada; komponen baru hanya jika pola belum ada.
