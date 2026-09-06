# Claude — ikuti repo ini

Baca **`AGENTS.md`** di root sebelum menulis kode. File ini hanya pointer.

Kunci:

- Next.js = UI. API Fastify. Worker BullMQ. Prisma hanya di API/worker/packages.
- Sesi browser = NextAuth (`apps/web`). OTP + satu sesi = `apps/api`. Bukan Firebase, bukan JWT di `localStorage`.
- UI = Mantine. Dilarang `style={{ … }}`. Komponen di `apps/web/components/`, helper di `apps/web/lib/`.
- Jangan percaya `cost`/`role`/`balance` dari klien. Jangan potong poin dari UI.
- ADR di `docs/adr/` terkunci; perubahan = ADR baru.
- SDLC: `aidlc/README.md`. Orchestrator tidak menulis kode produk.

Scoped: `apps/web/AGENTS.md`, `apps/api/AGENTS.md`.
