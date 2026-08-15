# syntax=docker/dockerfile:1
#
# Build multi-stage para o frontend (Next.js standalone) num monorepo
# pnpm+Turborepo. Rode a partir da RAIZ do monorepo:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.seudominio.com \
#     -t leilao-erp-web .
#
# Não testado neste ambiente (sem Docker disponível na sessão de
# desenvolvimento) — revise antes de usar em produção.

FROM node:20-alpine AS base
RUN corepack enable

# ---- Poda: gera um subconjunto do monorepo só com o que o web precisa ----
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY . .
RUN npx turbo prune @leilao-erp/web --docker

# ---- Instala dependências + builda a partir do subconjunto podado ----
FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

# Next.js embute NEXT_PUBLIC_* no bundle em build-time, não em runtime.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm --filter @leilao-erp/types build
RUN pnpm turbo run build --filter=@leilao-erp/web

# ---- Imagem final: usa o output standalone do Next (bem mais enxuto) ----
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app

COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3002
ENV NODE_ENV=production
ENV PORT=3002
CMD ["node", "apps/web/server.js"]
