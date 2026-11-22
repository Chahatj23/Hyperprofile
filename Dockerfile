# Production Dockerfile for Hyperprofile API & Engine (Google Cloud Run)
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
ENV PORT=8080

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/ ./apps/api/

# Optional disk storage fallback for rules, account and activity
COPY *real-ig-account.jso[n] ./
COPY *real-ig-rules.jso[n] ./
COPY *real-ig-activity.jso[n] ./
COPY *claimed-comments.jso[n] ./
RUN touch real-ig-account.json real-ig-rules.json real-ig-activity.json claimed-comments.json || true

EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
