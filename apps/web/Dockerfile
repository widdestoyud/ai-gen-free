FROM node:22-alpine
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
COPY packages/providers-fal/package.json packages/providers-fal/
COPY packages/providers-midtrans/package.json packages/providers-midtrans/
COPY packages/providers-xendit/package.json packages/providers-xendit/
COPY packages/providers-dana/package.json packages/providers-dana/
COPY packages/providers-doku/package.json packages/providers-doku/
COPY packages/storage/package.json packages/storage/
COPY packages/wallet/package.json packages/wallet/
RUN pnpm install --frozen-lockfile
COPY . .
ARG API_INTERNAL_URL=http://api:4000
ARG AUTH_SECRET=change-me-to-32-bytes-min
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_TRUST_HOST=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm --filter @ai-gen-free/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@ai-gen-free/web", "start"]
