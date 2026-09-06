# Web auth and UI

- Browser session: adapter behind `lib/auth-actions.ts` + `lib/server-api.ts`. NextAuth only in `auth.ts` / session routes. Swapping Auth.js must not change pages or layout (ADR 0012).
- OTP identity stays in `apps/api`. UI must not set a third session cookie.
- UI kit: Mantine. No `style={{ … }}`. Reuse `apps/web/components/*`. Helpers in `apps/web/lib/*`.
- Browser only calls same-origin `/api/*`. Next BFF proxies to Fastify (`API_INTERNAL_URL`). Do not publish API ports to the host or use `NEXT_PUBLIC_API_URL`.
- Do not hardcode MinIO/Mailpit in Compose; `STORAGE_*` / `SMTP_*` / `SIRAY_*` come from `.env`.
