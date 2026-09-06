Follow root `AGENTS.md` and `docs/adr/`. Do not invent architecture.

- `apps/web`: Mantine UI, NextAuth cookies, HTTP to the API. No inline styles, no Prisma, no Siray SDK, no JWT in localStorage.
- `apps/api` / `apps/worker` / `packages/*`: domain, ledger hold/capture, jobs. Do not edit `apps/web`.
- OTP and single-session live in the API. NextAuth JWT only stores the API session token (`sid`).
- New locked decisions require a new ADR. UI copy is Indonesian.
