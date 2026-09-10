# Gemini

Follow root `AGENTS.md`. Architecture: `docs/architecture.md`. Locked decisions: `docs/adr/`.

Browser session = NextAuth in `apps/web`. UI = Mantine, no inline styles. OTP stays in `apps/api`. Next.js does not use Prisma or the Siray SDK. Action payloads are JSON body only, never query params (ADR 0016). Postman updates strictly maintain 1 collection file (`ai-gen-free.postman_collection.json`) and 1 environment file (`local.postman_environment.json`).
