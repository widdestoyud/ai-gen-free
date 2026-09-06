# Steering

Sumber kebenaran: [`AGENTS.md`](../../AGENTS.md). File di folder ini, `.grok/rules/`, `.cursor/rules/`, `CLAUDE.md`, dan `.github/copilot-instructions.md` **menunjuk** ke situ.

| Tool | Lokasi |
|---|---|
| Semua | `AGENTS.md`, `apps/web/AGENTS.md`, `apps/api/AGENTS.md` |
| Kiro | `.kiro/steering/*.md` |
| Grok | `.grok/rules/*.md` + `.grok/agents/` |
| Cursor | `.cursor/rules/*.mdc` |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Gemini | `GEMINI.md` |
| Codex | `AGENTS.md` |

Jangan menduplikasi ADR. Jika aturan berubah, edit `AGENTS.md` + ADR baru, lalu sesuaikan pointer.
