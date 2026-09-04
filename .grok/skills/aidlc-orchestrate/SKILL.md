---
name: aidlc-orchestrate
description: >
  Run the project AIDLC MVP slice with orchestrator plus PO, SA, BE, FE, QA
  subagents. Use when the user says /aidlc, run SDLC, jalankan milestone, or
  asks specialists to implement a unit.
---

# AIDLC orchestrate

1. Read `aidlc/README.md`, `AGENTS.md`, and `docs/github/milestones.md`.
2. Identify the unit (`M0` … `M5` or a named intent).
3. Prefer launching workflow `aidlc-mvp` with `{ intent: "<id>" }`.
4. If staying in-session, switch behavior to `.grok/agents/orchestrator.md` and spawn `po`, `sa`, `be`, `fe`, `qa` in that order with a human gate after SA.
5. Never implement feature code as the orchestrator.
6. After QA, update the matching row in `docs/github/milestones.md` (status only; do not invent completed work).
