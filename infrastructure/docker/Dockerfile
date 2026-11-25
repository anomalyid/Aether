# Aether API — image development/production base
# By Anomalyid

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@12.21.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@12.21.0 --activate
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/domains ./domains
COPY --from=builder /app/adapters ./adapters
COPY --from=builder /app/protocols ./protocols
COPY --from=builder /app/developer ./developer

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/api/dist/bin.js"]
