# Production Dockerfile for Hyperprofile API & Engine
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hyperprofile/api... run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/ ./apps/api/

# Persistent disk storage fallback for rules, account and activity
COPY real-ig-account.json ./real-ig-account.json
COPY real-ig-rules.json ./real-ig-rules.json
COPY real-ig-activity.json ./real-ig-activity.json
COPY claimed-comments.json ./claimed-comments.json

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]

