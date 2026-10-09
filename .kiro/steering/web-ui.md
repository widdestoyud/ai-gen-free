---
inclusion: fileMatch
fileMatchPattern: ["apps/web/**", "apps/web/AGENTS.md"]
---

# Web UI

Kanonik: `#[[file:apps/web/AGENTS.md]]` `#[[file:docs/adr/0010-nextauth-session.md]]` `#[[file:docs/adr/0011-mantine-ui.md]]`

- Komponen: Mantine. Dilarang `style={{ … }}`.
- Item berulang: `apps/web/components/` (`PageShell`, `ItemCard`, `ErrorAlert`, `AppLink`, …).
- Helper: `apps/web/lib/` (fetch error, format IDR/tanggal, status job, session).
- Login: `signIn` NextAuth Credentials → API OTP verify. Request OTP tetap `POST /api/auth/otp/request` (proxy Fastify).
- NextAuth user `basePath`: `/api/session`. Admin: `/api/admin/session`.
- Polling job: `GET /api/jobs/:id`. Refresh tidak membatalkan job.
- **Larangan Refetch Interval**: Frontend DILARANG memakai `refetchInterval` (TanStack Query) atau polling periodik ke API via `setInterval`. Sinkronisasi data realtime (saldo wallet, status invoice, dll.) WAJIB murni event-driven via Server-Sent Events (SSE `/api/invoices/events`) dan invalidasi cache on-demand (`queryClient.invalidateQueries(...)`).
- Copy Indonesia. Cooldown dan `409`/`429` ditampilkan ke user.
