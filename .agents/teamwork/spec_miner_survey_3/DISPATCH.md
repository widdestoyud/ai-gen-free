# Dispatch: Test Baseline & Coverage Spec Miner

Identity: teamwork_preview_spec_miner
Role: Test Baseline & Coverage Spec Miner
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/spec_miner_survey_3
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Conduct an in-depth survey of the automated test suite and verification tooling across the repository.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md.
2. Investigate the existing test configuration (Vitest/Jest, test scripts, fixtures, test environments, mocks) in @ai-gen-free/api and @ai-gen-free/web.
3. Inventory the baseline 102 passing backend tests: identify all test files, test suites, test cases, and what functionality they cover.
4. Identify test coverage gaps across critical services:
   - Authentication (login, logout, refresh, session invalidation, OTP rate limiting, single-session conflicts)
   - Wallet and billing (sparks balance, credit deduction, atomic balance protection, transactions, stripe/payment webhooks)
   - AI job lifecycle (submission, queueing, polling, status transitions, failure handling, cancellation)
   - Uploads (presigned URLs, mime type validation, file size limits, s3/storage integration)
5. Review build and verification scripts: `pnpm --filter @ai-gen-free/api test`, `pnpm --filter @ai-gen-free/api build`, `pnpm --filter @ai-gen-free/web build`, Docker compose setups.
6. Deliver detailed findings, full baseline inventory, gap matrix, and concrete test expansion specifications in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/spec_miner_survey_3/handoff.md following the Handoff Protocol. Send a message to orchestrator upon completion.


## 2026-10-08T08:08:29Z
You are teamwork_preview_spec_miner (Role: Test Baseline & Coverage Spec Miner).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/spec_miner_survey_3
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/spec_miner_survey_3/DISPATCH.md

You are a specification and test investigator. DO NOT modify any production source code. Investigate the automated test suite and verification tooling across the repository:
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md.
2. Investigate the existing test configuration (Vitest/Jest, test runners, fixtures, test environments, mocks) in @ai-gen-free/api and @ai-gen-free/web.
3. Inventory the baseline 102 passing backend tests: identify all test files, test suites, test cases, and what functionality they cover.
4. Identify test coverage gaps across critical services:
   - Authentication (login, logout, refresh, session invalidation, OTP rate limiting, single-session conflicts)
   - Wallet and billing (sparks balance, credit deduction, atomic balance protection, transactions, stripe/payment webhooks)
   - AI job lifecycle (submission, queueing, polling, status transitions, failure handling, cancellation)
   - Uploads (presigned URLs, mime type validation, file size limits, s3/storage integration)
5. Review build and verification scripts: `pnpm --filter @ai-gen-free/api test`, `pnpm --filter @ai-gen-free/api build`, `pnpm --filter @ai-gen-free/web build`, Docker compose setups.
6. Maintain progress.md in your working directory with timestamps.
7. Deliver detailed findings, full baseline inventory, gap matrix, and concrete test expansion specifications in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/spec_miner_survey_3/handoff.md following the Handoff Protocol.
8. Send a completion message back to your orchestrator when done.
