# Dispatch: Frontend Architecture & Optimization Explorer

Identity: teamwork_preview_explorer
Role: Frontend Architecture & Optimization Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Conduct an in-depth survey of the frontend codebase (@ai-gen-free/web and related packages).
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md.
2. Investigate Next.js web application architecture (App router / Pages router, layouts, providers).
3. Investigate Mantine component patterns across the application. Identify inconsistent patterns, custom implementations duplicating Mantine built-ins, and styling issues.
4. Audit state management across pages and components. Identify duplicate state management logic, unnecessary re-renders, and component lifecycle inefficiencies.
5. Audit React Query (TanStack Query) cache usage, query keys, invalidation triggers, and cache synchronization issues.
6. Investigate Next.js BFF (Backend For Frontend) proxy routes (/api/... in web). Inspect how they forward requests to Fastify API, handle authentication/cookies/session tokens, rate limiting, and error handling.
7. Identify specific files, line numbers, and improvement opportunities for Requirement R3 and BFF proxy aspects of R1/R2.
8. Deliver your detailed findings and actionable recommendations in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2/handoff.md following the Handoff Protocol. Send a message to orchestrator upon completion.

## 2026-10-08T08:08:29Z
You are teamwork_preview_explorer (Role: Frontend Architecture & Optimization Explorer).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2/DISPATCH.md

You are an exploratory subagent. DO NOT modify any production source code. Read and analyze the codebase to produce an in-depth survey of frontend architecture, component standardization, state management, and BFF proxy routes:
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md.
2. Investigate Next.js web application architecture (@ai-gen-free/web), routing, layout structure, and provider setup.
3. Investigate Mantine component patterns across the web app. Identify non-standard implementations, duplicate UI logic, unstyled or inconsistent controls, and opportunities to adopt Mantine built-ins.
4. Audit state management across pages and components: identify duplicate state stores, redundant state synchronization, and unnecessary component re-renders.
5. Audit React Query (TanStack Query) cache usage, query keys, invalidation triggers, and cache synchronization issues.
6. Investigate Next.js BFF (Backend For Frontend) proxy routes (/api/... in web). Inspect how they forward requests to Fastify API, handle authentication cookies/session tokens, rate limiting, and error handling.
7. Identify exact file paths, line numbers, and concrete refactoring plans for Requirement R3 and the frontend/BFF aspects of R1/R2.
8. Maintain progress.md in your working directory with timestamps.
9. Deliver your comprehensive survey report to /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2/handoff.md following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
10. Send a completion message back to your orchestrator when done.
