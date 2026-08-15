# Firmus - Gestão Imobiliária

ERP especializado em operações imobiliárias — imóveis adquiridos em leilões judiciais e extrajudiciais, venda direta intermediada por corretores (com financiamento Caixa) e imóveis de terceiros sob gestão imobiliária — do prospecção à distribuição de lucro aos investidores.

> Arquitetura completa (ERD, fluxos de navegação, RBAC, roadmap por fases): [docs/architecture.md](docs/architecture.md)
> Manual de uso do sistema (para quem opera, não desenvolve): [docs/manual-usuario.md](docs/manual-usuario.md)

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + TailwindCSS v4 + componentes no padrão shadcn/ui
- **Backend:** NestJS + Prisma + PostgreSQL
- **Auth:** JWT (access + refresh rotativo) em cookies httpOnly, CSRF (double-submit cookie), 2FA/TOTP opcional por usuário
- **Storage:** S3-compatible (MinIO em dev, S3 em produção) com URLs pré-assinadas
- **Infra dev:** Docker Compose (Postgres, Redis, MinIO, Adminer) — ver nota sobre Windows/OneDrive abaixo
- **Monorepo:** pnpm workspaces + Turborepo

## Estrutura

```
apps/
  web/     Next.js (frontend)
  api/     NestJS (backend)
packages/
  types/   Schemas Zod e enums compartilhados entre web e api
  config/  tsconfig/eslint base compartilhados
infra/
  docker/  docker-compose.yml do ambiente de desenvolvimento
  start-minio.ps1  script auxiliar para subir o MinIO no Windows (ver nota abaixo)
docs/
  architecture.md
```

## Pré-requisitos

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker Desktop (recomendado para Postgres/Redis/MinIO) — instale em https://www.docker.com/products/docker-desktop/
  - Alternativa sem Docker (usada neste ambiente): PostgreSQL nativo + MinIO nativo (binário único), ver `infra/start-minio.ps1`.

## Setup local

1. **Instalar dependências** (na raiz do monorepo):
   ```bash
   pnpm install
   ```

2. **Subir a infraestrutura**:
   - Com Docker: `docker compose -f infra/docker/docker-compose.yml up -d`
   - Sem Docker no Windows: instale o PostgreSQL nativamente e rode `infra/start-minio.ps1` para subir o MinIO.
     ⚠️ **Se a pasta do projeto estiver dentro do OneDrive**, mantenha os dados do Postgres/MinIO **fora** da pasta sincronizada — o OneDrive trava/corrompe arquivos abertos continuamente por esses processos. O script `start-minio.ps1` já resolve isso automaticamente (usa `%LOCALAPPDATA%`).

3. **Configurar variáveis de ambiente**:
   ```bash
   cp .env.example apps/api/.env
   cp .env.example apps/web/.env.local
   ```
   Ajuste `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` no `apps/api/.env` para valores aleatórios fortes.

4. **Rodar migrations e seed**:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```
   O seed cria a empresa `empresa-demo` com o usuário administrador:
   - Empresa: `empresa-demo`
   - E-mail: `admin@empresademo.com`
   - Senha: `Admin@123456`

   > Sempre que novas permissões forem adicionadas ao catálogo (`packages/types/src/permissions.ts`), rode `pnpm db:seed` novamente — é idempotente e concede as novas permissões aos papéis-base existentes. Usuários já logados precisam fazer login de novo para receber um token com as permissões atualizadas.

5. **Subir a aplicação**:
   ```bash
   pnpm dev
   ```
   - API: http://localhost:3001/api (Swagger em `/api/docs`)
   - Web: http://localhost:3002 *(3000 pode já estar ocupada por outro projeto local; ajuste `CORS_ORIGIN` no `.env` se mudar a porta)*

## Scripts úteis (raiz)

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe api + web em modo desenvolvimento |
| `pnpm build` | Build de produção de todos os pacotes/apps |
| `pnpm lint` | Lint em todos os pacotes/apps |
| `pnpm typecheck` | Checagem de tipos em todos os pacotes/apps |
| `pnpm db:migrate` | Roda migrations do Prisma |
| `pnpm db:seed` | Popula empresa/usuário de demonstração e sincroniza permissões |
| `pnpm db:studio` | Abre o Prisma Studio |

## Status do desenvolvimento

Este projeto segue o roadmap em fases descrito em [docs/architecture.md](docs/architecture.md#11--roadmap-por-fases).

- [x] **Fase 0 — Fundação:** monorepo, Docker Compose, auth (JWT + refresh rotativo), multiempresa, RBAC granular configurável, design system (dark/light, glassmorphism discreto), Swagger, auditoria append-only.
- [x] **Fase 1 — Prospecção de imóveis:** cadastro completo de oportunidades (origem, edital, localização, características, valores, risco, status, prioridade), tags, upload de fotos e documentos versionados (URLs pré-assinadas via storage S3-compatible), KPI de imóveis por status no dashboard.
- [x] **Fase 2 — Due Diligence & Aquisição:** checklist padrão (10 itens com criticidade, responsável, prazo, status, comentários e arquivos), bloqueio automático da aquisição enquanto houver pendência crítica em aberto, registro de aquisição com cálculo automático de custo total/capital investido/valor por m², transição automática do imóvel para "Adquirida".
- [x] **Fase 3 — Jurídico & Reforma:** processo jurídico (`LegalCase`) criado automaticamente ao registrar a aquisição, com status dedicado (pagamento → carta de arrematação → registro → imissão na posse → negociação/desocupação), prazos e audiências com alerta de atraso, documentos versionados; Kanban de reforma por imóvel e visão consolidada de todos os imóveis, com arrastar-e-soltar nativo entre 12 etapas, dependências entre tarefas, checklist, comentários, mídia (foto/vídeo) e valores previsto/realizado.
- [x] **Fase 4 — Financeiro & Caixa:** hierarquia de contas de caixa (geral → empresa → SPE → imóvel) com reparenteamento e proteção contra ciclos; toda empresa ganha uma conta raiz e todo imóvel ganha sua própria conta automaticamente; categorias de receita/despesa; lançamentos previsto x realizado com conciliação; DRE e fluxo de caixa mensal por imóvel; página global de Caixa e KPI financeiro consolidado no dashboard.
- [x] **Fase 5 — Simulador:** cenários Otimista/Realista/Pessimista por imóvel (um de cada, editáveis independentemente), com sugestão automática de capital investido a partir da Aquisição + Reforma; ROI, margem, payback, TIR anualizada e VPL calculados na camada de aplicação a partir de um modelo de fluxo de caixa de dois pontos (investimento em t=0, venda líquida em t=prazo); aba no detalhe do imóvel e página standalone com seletor de imóvel.
- [x] **Fase 6 — Investidores & distribuição de lucro:** cadastro de investidores (dados bancários/PIX), participação percentual e aporte por imóvel (com validação de soma ≤100%), sugestão automática de lucro base a partir da DRE do imóvel, cálculo de distribuição de lucro com IR estimado (bruto/IR/líquido), controle de status pendente/pago com histórico protegido (distribuições pagas não podem ser excluídas). Somente lado administrativo nesta fase — portal de login próprio do investidor fica para uma fase futura.
- [x] **Fase 7 — Vendas:** cadastro de corretores com comissão, pipeline de venda por imóvel (exige aquisição concluída), propostas de compradores, contrato com upload do documento assinado, financiamento e recebíveis (parcelas) com alerta de atraso. Ao concluir a venda, o imóvel é automaticamente marcado como VENDIDA (encerramento automático da operação). Página global de pipeline + corretores, e aba dedicada no detalhe do imóvel.
- [x] **Fase 8 — Relatórios & Painel Executivo:** exportação sob demanda em PDF e Excel (resumo de portfólio, dossiê do imóvel, DRE, pipeline de vendas), montada a partir dos dados ao vivo dos módulos existentes — nenhum dado duplicado, só o arquivo final persistido no storage; painel executivo com gráficos (imóveis por status e por prioridade) no dashboard. Mapa geográfico fica para uma fase futura (exigiria geolocalização dos imóveis, hoje não armazenada).
- [ ] Fase 9 — IA & Notificações avançadas *(adiada a pedido — sem previsão)*
- [x] **Fase 10 — Hardening & AWS:** sessão migrada de `localStorage`/Bearer para **cookies httpOnly** (access token + refresh token com paths distintos), proteção **CSRF** por double-submit cookie (`XSRF-TOKEN` + header `X-CSRF-Token`, validado por `CsrfGuard` em toda rota mutante), **2FA/TOTP** completo (setup com QR code, ativação, desativação, exigido no login quando habilitado), `helmet` (cabeçalhos de segurança) e rate limiting global + reforçado em login/verificação de 2FA; **Row Level Security** do Postgres habilitada (policy `tenant_isolation` por `companyId` nas tabelas multiempresa, validada isolando duas empresas com `FORCE ROW LEVEL SECURITY` temporário) — ver limitação abaixo sobre o alcance real do enforcement; scaffold de deploy (Dockerfiles multi-stage via `turbo prune --docker`, `docker-compose.prod.yml`, Terraform completo para AWS em `infra/aws/`) **não testado contra Docker/AWS reais** neste ambiente de desenvolvimento.

## Limitações conhecidas

- **Row Level Security habilitada mas não forçada contra a própria conexão da aplicação**: as policies (`tenant_isolation`) existem e foram validadas (isolam corretamente duas empresas quando `FORCE ROW LEVEL SECURITY` é ativado), mas a role do Postgres usada pela API é dona das tabelas — donos de tabela ignoram RLS por padrão, e isso foi deixado assim deliberadamente. Forçar o enforcement exigiria a API definir `app.current_company_id` de forma confiável por conexão, o que não é seguro com o pool padrão do Prisma sem PgBouncer em session-mode ou reescrever todo serviço para rodar dentro de uma transação por requisição — mudança invasiva demais para este momento sem risco de quebrar a atomicidade de operações multi-etapa existentes (ex.: Aquisição→Processo jurídico, conclusão de Venda→status do imóvel). Hoje o isolamento multiempresa efetivo continua sendo o filtro `companyId` em cada query do Prisma (auditado); a RLS é uma camada de defesa em profundidade pronta para ser forçada numa fase futura de infraestrutura.
- Infraestrutura de deploy (Docker/Terraform da Fase 10) foi revisada por inspeção (sintaxe, padrões documentados do Turborepo/AWS) mas **não foi executada** — este ambiente de desenvolvimento não tem Docker Desktop nem AWS CLI/credenciais disponíveis. Validar com `docker build`/`terraform plan` reais antes de qualquer deploy em produção.
- Máquina de estados de `Property.status` cobre o funil de prospecção + aquisição + venda (`ADQUIRIDA`/`VENDIDA`); jurídico (`LegalCase.status`), reforma (`RenovationTask.stage`) e venda (`Sale.status`) têm suas próprias máquinas de estado internas desde as Fases 3 e 7.
- Painel executivo ainda não tem visualização em mapa (exigiria latitude/longitude dos imóveis e uma lib de mapas) — avaliar se entra em uma fase futura.
- Fase 9 (IA & Notificações avançadas) foi adiada a pedido do usuário — não implementada.
