# Claude — ikuti repo ini

Baca **`AGENTS.md`** di root sebelum menulis kode. File ini hanya pointer.

Kunci:

- Next.js = UI. API Fastify. Worker BullMQ. Prisma hanya di API/worker/packages.
- Sesi browser = NextAuth (`apps/web`). OTP + satu sesi = `apps/api`. Bukan Firebase, bukan JWT di `localStorage`.
- UI = Mantine. Dilarang `style={{ … }}`. Komponen di `apps/web/components/`, helper di `apps/web/lib/`.
- Jangan percaya `cost`/`role`/`balance` dari klien. Jangan potong poin dari UI.
- Payload aksi hanya JSON body, bukan query param (ADR 0016).
- Postman = tepat 1 koleksi (`ai-gen-free.postman_collection.json`) & 1 environment (`local.postman_environment.json`).
- ADR di `docs/adr/` terkunci; perubahan = ADR baru.
- SDLC: `aidlc/README.md`. Orchestrator tidak menulis kode produk.

Scoped: `apps/web/AGENTS.md`, `apps/api/AGENTS.md`.
