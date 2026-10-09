# Dispatch: Backend Security & Architecture Explorer

Identity: teamwork_preview_explorer
Role: Backend Security & Architecture Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Conduct an in-depth survey of the backend codebase (@ai-gen-free/api and related packages).
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md.
2. Investigate backend structure, Fastify server setup, route registration, plugins, and middlewares.
3. Audit authentication, session token lifecycles (creation, validation, expiration, refresh), and single-session enforcement implementation.
4. Audit input sanitization, validation schemas (Zod/TypeBox/etc.), and rate-limiting policies across Fastify backend routes.
5. Inspect Prisma schema, database models, relations, indexes, connection management, and existing query bottlenecks.
6. Inspect Redis caching strategies, key patterns, TTLs, invalidation logic, and connection handling.
7. Identify specific files, line numbers, vulnerabilities, bottlenecks, and improvement opportunities for Requirements R1 and R2.
8. Deliver your detailed findings and actionable recommendations in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md following the Handoff Protocol. Send a message to orchestrator upon completion.


## 2026-10-08T08:08:29Z
Received dispatch message:
You are teamwork_preview_explorer (Role: Backend Security & Architecture Explorer).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/DISPATCH.md
