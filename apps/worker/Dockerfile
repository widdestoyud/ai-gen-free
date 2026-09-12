FROM node:22-alpine
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/providers-types/package.json packages/providers-types/
COPY packages/providers-siray/package.json packages/providers-siray/
COPY packages/storage/package.json packages/storage/
COPY packages/wallet/package.json packages/wallet/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate
EXPOSE 3002
CMD ["pnpm", "--filter", "@ai-gen-free/worker", "start"]
