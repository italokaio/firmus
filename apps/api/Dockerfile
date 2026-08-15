# syntax=docker/dockerfile:1
#
# Build multi-stage para a API (NestJS) num monorepo pnpm+Turborepo.
# Rode a partir da RAIZ do monorepo:
#   docker build -f apps/api/Dockerfile -t leilao-erp-api .
#
# Não testado neste ambiente (sem Docker disponível na sessão de
# desenvolvimento) — revise antes de usar em produção.

FROM node:20-alpine AS base
RUN corepack enable

# ---- Poda: gera um subconjunto do monorepo só com o que a API precisa ----
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY . .
RUN npx turbo prune @leilao-erp/api --docker

# ---- Instala dependências + builda a partir do subconjunto podado ----
FROM base AS installer
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @leilao-erp/types build
RUN pnpm --filter @leilao-erp/api exec prisma generate
RUN pnpm turbo run build --filter=@leilao-erp/api
# Remove devDependencies (mantém só o necessário para `node dist/main.js`).
RUN pnpm prune --prod

# ---- Imagem final, roda como usuário não-root ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /app
COPY --from=installer --chown=nestjs:nodejs /app .
USER nestjs

WORKDIR /app/apps/api
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
