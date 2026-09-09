# Gemini

Follow root `AGENTS.md`. Architecture: `docs/architecture.md`. Locked decisions: `docs/adr/`.

Browser session = NextAuth in `apps/web`. UI = Mantine, no inline styles. OTP stays in `apps/api`. Next.js does not use Prisma or the Siray SDK. Action payloads are JSON body only, never query params (ADR 0016).
