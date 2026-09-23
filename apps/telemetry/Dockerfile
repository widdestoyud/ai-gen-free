FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/telemetry/package.json apps/telemetry/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/providers-types/package.json packages/providers-types/
COPY packages/providers-siray/package.json packages/providers-siray/
COPY packages/storage/package.json packages/storage/
COPY packages/wallet/package.json packages/wallet/
COPY packages/providers-midtrans/package.json packages/providers-midtrans/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate
EXPOSE 5050
CMD ["pnpm", "--filter", "@ai-gen-free/telemetry", "start"]
