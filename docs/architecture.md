# ERP de Gestão Imobiliária (Firmus)
### Documento de Arquitetura — v1.0 (para validação)

> Este documento precede qualquer implementação e descreve o desenho original do sistema, focado no fluxo de imóveis de leilão. Desde então o sistema passou a suportar também venda direta (corretor/financiamento Caixa) e gestão de imóveis de terceiros via o campo `tipoOperacao` — o modelo de dados abaixo é o núcleo comum aos três; o funil de Due Diligence/Aquisição/Jurídico descrito aqui é específico do fluxo de leilão. Cobre: stack, estrutura de pastas, modelo de dados (ERD), fluxos de navegação, estratégia de autenticação/autorização e roadmap por fases. Após validação, a implementação começa pela **Fase 0**.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Observações |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR/RSC para dashboards, rotas protegidas por middleware |
| UI | TailwindCSS + shadcn/ui + Radix | Design system próprio sobre shadcn (ver seção 7) |
| Estado/dados | TanStack Query + Zustand | Query para server-state, Zustand para UI-state (sidebar, tema, filtros) |
| Formulários | React Hook Form + Zod | Mesmos schemas Zod compartilhados com o backend (`packages/types`) |
| Gráficos | Tremor / Recharts | KPIs, séries temporais, rankings |
| Backend | NestJS (Node.js + TypeScript) | Clean Architecture por módulo, Swagger nativo |
| ORM | Prisma | Migrations versionadas, seeds |
| Banco | PostgreSQL 16 | Row Level Security como reforço de isolamento multiempresa |
| Cache/Filas | Redis + BullMQ | Notificações, geração de relatórios, jobs assíncronos |
| Storage | S3 (AWS) / MinIO (dev) | URLs pré-assinadas, versionamento de documentos |
| Autenticação | JWT (access) + Refresh Token rotativo | Cookies httpOnly, revogação em banco |
| IA | Claude (Anthropic) via tool-use | Ferramentas read-only sobre o banco (ver seção 8) |
| Infra | Docker Compose (dev) → AWS ECS/Fargate + RDS + S3 + CloudFront (prod) | Terraform na Fase 10 |
| Testes | Jest + Supertest (API), Vitest + RTL (Web), Playwright (E2E) | Cobertura mínima definida por módulo |
| Observabilidade | Pino (logs estruturados) + Sentry + tabela de auditoria | |

**Monorepo** gerenciado com `pnpm` + `Turborepo`.

---

## 2. Estrutura de Pastas (Monorepo)

```
leilao-erp/
├── apps/
│   ├── web/                         # Next.js
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (app)/dashboard/
│   │   │   ├── (app)/properties/[id]/
│   │   │   ├── (app)/legal/
│   │   │   ├── (app)/renovation/
│   │   │   ├── (app)/finance/
│   │   │   ├── (app)/simulator/
│   │   │   ├── (app)/investors/[id]/
│   │   │   ├── (app)/sales/
│   │   │   ├── (app)/documents/
│   │   │   ├── (app)/reports/
│   │   │   ├── (app)/settings/
│   │   │   ├── (app)/ai-assistant/
│   │   │   └── (portal)/portal/...   # portal do investidor
│   │   ├── components/               # componentes específicos do app
│   │   └── lib/                      # api client, hooks
│   │
│   └── api/                          # NestJS
│       └── src/
│           ├── modules/
│           │   ├── auth/
│           │   ├── companies/                (tenancy)
│           │   ├── users/
│           │   ├── roles-permissions/
│           │   ├── properties/                (Módulo 1 – Prospecção)
│           │   ├── due-diligence/             (Módulo 2)
│           │   ├── acquisition/               (Módulo 3)
│           │   ├── legal/                     (Módulo 4)
│           │   ├── renovation/                (Módulo 5 – Kanban)
│           │   ├── finance/                   (Módulo 6 + 9 – DRE/Caixa)
│           │   ├── simulator/                 (Módulo 7)
│           │   ├── investors/                 (Módulo 8)
│           │   ├── sales/                     (Módulo 10)
│           │   ├── documents/
│           │   ├── notifications/
│           │   ├── audit/
│           │   ├── reports/
│           │   ├── ai-assistant/
│           │   └── dashboard/
│           ├── common/               # guards, decorators, filters, pipes, interceptors
│           └── infrastructure/       # prisma, storage (s3), mail, queue (bullmq)
│
├── packages/
│   ├── ui/                # componentes shadcn compartilhados / design tokens
│   ├── types/             # DTOs e schemas Zod compartilhados web+api
│   └── config/            # eslint, tsconfig, tailwind config base
│
├── infra/
│   ├── docker/            # docker-compose.yml, Dockerfiles
│   └── aws/               # terraform (Fase 10)
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
└── docs/
    ├── architecture.md    # este arquivo
    └── modules/           # 1 doc técnico por módulo, criado a cada fase
```

**Padrão interno de cada módulo do backend** (Clean Architecture):

```
modules/<modulo>/
├── domain/          # entidades, value-objects, interfaces de repositório
├── application/     # use-cases, services, DTOs, validações de regra de negócio
├── infrastructure/  # implementação Prisma dos repositórios
└── presentation/    # controllers REST + Swagger decorators
```

---

## 3. Multiempresa (Multi-tenancy)

- **Estratégia:** banco compartilhado, schema compartilhado, coluna `companyId` em toda tabela com dado de tenant.
- **Reforço:** Postgres Row Level Security (`USING (company_id = current_setting('app.company_id'))`) como segunda camada, além do filtro automático no Prisma.
- **Injeção automática:** middleware Nest usa `AsyncLocalStorage` para guardar `companyId` da requisição autenticada e um Prisma Client Extension injeta o filtro em toda query — nenhum desenvolvedor precisa lembrar de filtrar manualmente.
- **Resolução do tenant:** claim `companyId` dentro do JWT (setado no login); sem cross-tenant possível mesmo com token válido de outra empresa.

---

## 4. Controle de Acesso (RBAC + Permissões Granulares)

### Modelo
- `Role` (Administrador, Sócio, Diretor, Gerente, Jurídico, Engenharia, Financeiro, Corretor, Investidor, Visitante) — perfis-base por empresa, editáveis.
- `Permission` — granular, formato `modulo:acao` (ex.: `finance:view`, `properties:create`, `legal:edit`, `investors:view:own`).
- `RolePermission` — matriz configurável pela empresa (Administrador pode reconfigurar quem vê o quê).
- `UserRole` — usuário pode ter mais de um papel.
- **Escopo de linha (row-level):** perfil Investidor enxerga apenas registros de `PropertyInvestor` onde `investorId` = o investidor vinculado ao seu usuário. Perfil Visitante tem todas as permissões como `:view` e nenhuma de escrita.

### Matriz inicial (resumo)

| Perfil | Prospecção | Due Diligence | Jurídico | Reforma | Financeiro | Investidores | Vendas | Config |
|---|---|---|---|---|---|---|---|---|
| Administrador | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| Sócio | View | View | View | View | View (tudo) | View | View | — |
| Diretor | View | View | View | View | View (indicadores) | View | View | — |
| Gerente | CRUD | CRUD | View | CRUD | View | View | CRUD | — |
| Jurídico | View | View | CRUD | — | — | — | — | — |
| Engenharia | View | — | — | CRUD | — | — | — | — |
| Financeiro | View | — | — | View | CRUD | View | View | — |
| Corretor | — | — | — | — | — | — | CRUD (próprias) | — |
| Investidor | — | — | — | — | View (próprio) | View (próprio) | View (próprio) | — |
| Visitante | View | View | View | View | View | View | View | — |

*(matriz completa e editável via UI em Configurações → Papéis e Permissões)*

### Guards (Nest)
`JwtAuthGuard` → `TenantGuard` → `PermissionsGuard` (`@RequirePermission('finance:view')`) → `RowScopeGuard` (aplica escopo de investidor quando o papel exige).

---

## 5. Autenticação

- **Login:** e-mail + senha (hash Argon2) → access token JWT (15 min, contém `userId`, `companyId`, `roles`, `permissionsHash`) + refresh token (7–30 dias, cookie httpOnly + secure, hash armazenado em `RefreshToken` no banco, rotação a cada uso, revogável).
- **Renovação silenciosa** via endpoint `/auth/refresh`.
- **Logout** revoga o refresh token corrente (e opção "sair de todos os dispositivos").
- **2FA** (TOTP) preparado no schema, ativação na Fase 10.
- **Portal do investidor** usa o mesmo mecanismo, mas o front renderiza um shell separado (`(portal)`) com navegação restrita.

---

## 6. Modelo de Dados — ERD (entidades e relacionamentos)

`Property` (Imóvel) é o agregado central. A maioria dos módulos pendura registros nele.

```
Company (tenant)
 ├── User ──< UserRole >── Role ──< RolePermission >── Permission
 ├── Investor
 ├── Broker
 ├── FinanceCategory
 ├── Tag
 └── Property
      ├── PropertyPhoto
      ├── PropertyDocument (versionado)
      ├── PropertyTag >── Tag
      ├── DueDiligenceChecklist ──< DueDiligenceItem
      │                                 (responsável, prazo, status, comentários, arquivos)
      ├── Acquisition (1:1)
      │     └── AcquisitionCostItem[] (lance, custas, ITBI, registro, escritura,
      │           honorários, comissões, taxas bancárias)
      ├── LegalCase (1:1) ──< LegalCaseEvent (prazos, audiências)
      │                  └──< LegalCaseDocument
      ├── RenovationBoard (1:1) ──< RenovationTask (kanban)
      │        RenovationTask ──< RenovationChecklistItem
      │                       ──< RenovationMedia (fotos/vídeos)
      │                       ──< RenovationComment
      ├── FinanceAccount (caixa do imóvel) ──< Transaction >── FinanceCategory
      │        Transaction também se relaciona a FinanceAccount de Company/SPE (hierarquia)
      ├── CashFlowProjection (previsto x realizado)
      ├── SimulatorScenario[] (Otimista/Realista/Pessimista — inputs e outputs)
      ├── PropertyInvestor >── Investor (percentual, aporte, contrato)
      │        └──< ProfitDistribution (prestação de contas por investidor)
      └── Sale (1:1)
            ├── Broker (comissão)
            ├── Proposal[]
            ├── SaleContract
            ├── Financing
            └── Receivable[] (parcelas)

AuditLog (polimórfico: entityType, entityId, userId, before, after, ip, device, timestamp)
Notification (userId, type, entityRef, lida/não lida)
Report (metadados de relatórios gerados, arquivo no storage)
```

### Tabela-resumo das entidades principais

| Entidade | Chave estrangeira principal | Observação |
|---|---|---|
| `Company` | — | Tenant raiz |
| `User` | `companyId` | Login, papéis |
| `Role` / `Permission` / `RolePermission` | `companyId` (Role) | Matriz configurável |
| `Investor` | `companyId` | CPF/CNPJ, dados bancários/PIX |
| `Property` | `companyId` | Status de ciclo de vida (enum abaixo) |
| `PropertyDocument` | `propertyId` | Versionado (`version`, `previousVersionId`) |
| `DueDiligenceItem` | `checklistId` | Bloqueia avanço se `status = pendente_critico` |
| `Acquisition` | `propertyId` (1:1) | Calcula custo total automaticamente |
| `LegalCase` | `propertyId` (1:1) | Máquina de estados própria (seção 6.1) |
| `RenovationTask` | `boardId` | Kanban com % concluído, custo previsto x realizado |
| `FinanceAccount` | `companyId`, `propertyId?` | Hierarquia: geral → empresa → SPE → imóvel |
| `Transaction` | `financeAccountId`, `categoryId` | Entrada/saída, concilição |
| `SimulatorScenario` | `propertyId` | Guarda inputs e outputs calculados (ROI, TIR, VPL, payback) |
| `PropertyInvestor` | `propertyId`, `investorId` | Percentual de participação |
| `ProfitDistribution` | `propertyInvestorId` | Lucro, IR estimado, status de pagamento |
| `Sale` | `propertyId` (1:1) | Ao concluir, dispara encerramento automático da operação |
| `AuditLog` | polimórfico | Nunca editável/deletável |

### 6.1 Máquina de estados de `Property.status`
```
prospeccao → em_analise → due_diligence → aprovado_para_compra → adquirido
  → juridico (subestados: aguardando_pagamento, carta_arrematacao, registro,
       imissao_posse, negociacao_amigavel, notificacao, despejo, acao_judicial,
       cumprimento, desocupado, arquivado)
  → em_reforma → pronto_para_venda → em_negociacao → vendido → encerrado
```
Transições são guardadas por regra de negócio (ex.: não sai de `due_diligence` com item crítico pendente).

---

## 7. Design System

- Base: shadcn/ui + Radix, tema custom em `packages/ui` com tokens de cor, espaçamento e tipografia versionados (light/dark via `next-themes`).
- Glassmorphism discreto: `backdrop-blur` + opacidade baixa em cards de destaque (KPIs, modais), nunca em texto de leitura longa.
- Densidade: espaçamento generoso, no máximo 3–4 elementos de destaque por tela (inspiração Linear/Notion).
- Motion: `framer-motion` para transições de página, kanban drag, abertura de painéis — sempre < 250ms, easing suave.
- Biblioteca de componentes própria sobre shadcn: `StatCard`, `KpiGrid`, `Kanban`, `Timeline`, `DocumentViewer`, `MoneyInput`, `StatusBadge` (mapeando cada enum de status a cor/ícone consistente).

---

## 8. Módulo de IA

- Camada de **ferramentas read-only** expostas ao modelo (function calling): `queryPortfolioKpis`, `queryPropertiesByRisk`, `queryOverdueRenovations`, `simulateSaleProfit`, `queryInvestorPayouts`, `queryMarginBelowThreshold`, `queryCashConsumption`.
- Cada tool executa uma query Prisma **já filtrada pelo `companyId` e permissões do usuário que perguntou** — a IA nunca tem acesso direto ao banco, apenas às tools.
- Resposta em linguagem natural + tabela/gráfico embutido quando aplicável.
- Modelo: Claude via Anthropic API (function calling / tool use), custo e latência controlados por cache de resultados intermediários (Redis).

---

## 9. Auditoria

- Interceptor global captura toda mutação (`create/update/delete`) em entidades sensíveis → grava em `AuditLog` (usuário, timestamp, IP, user-agent/dispositivo, diff `before/after` em JSON).
- Tabela `AuditLog` é *append-only* (sem update/delete permitido, nem para Administrador).
- Timeline de auditoria disponível por entidade (aba "Histórico" em cada imóvel/investidor/transação).

---

## 10. Fluxo de Navegação (mapa de telas)

```
/login
/(app)/dashboard                       → KPIs executivos, gráficos, mapa, rankings
/(app)/properties                      → lista/kanban de imóveis
   /properties/[id]                    → tabs: Visão Geral | Due Diligence | Aquisição
                                          | Jurídico | Reforma | Financeiro/DRE
                                          | Documentos | Investidores | Venda | Histórico
/(app)/due-diligence                   → fila cross-imóveis de pendências
/(app)/legal                           → fila jurídica + calendário de prazos/audiências
/(app)/renovation                      → kanban global (filtro por imóvel)
/(app)/finance                         → caixa geral/empresa/SPE/imóvel, conciliação, calendário
/(app)/simulator                       → simulador standalone (ou aberto a partir do imóvel)
/(app)/investors                       → lista de investidores
   /investors/[id]                     → aportes, participações, prestação de contas, histórico
/(app)/sales                           → pipeline de vendas
   /sales/[id]                         → proposta, contrato, financiamento, parcelas
/(app)/documents                       → central documental global
/(app)/reports                         → geração PDF/Excel
/(app)/notifications
/(app)/settings                        → empresa, usuários, papéis/permissões, categorias
/(app)/ai-assistant                    → chat com IA sobre os dados
/(portal)/portal/dashboard             → visão do investidor (somente seus dados)
/(portal)/portal/investments
/(portal)/portal/statements
```

---

## 11. Roadmap por Fases

| Fase | Entrega | Módulos do briefing cobertos |
|---|---|---|
| **0 — Fundação** | Monorepo, Docker Compose, CI, schema Prisma inicial, auth (JWT+refresh), multiempresa, RBAC base, design system (tema dark/light, shadcn) | Infra transversal |
| **1 — Cadastros core** | Company/User/Role mgmt, Prospecção de imóveis, upload de fotos/documentos, Tags, esqueleto do Dashboard | Módulo 1 |
| **2 — Due Diligence & Aquisição** | Checklist com bloqueio de avanço, cálculo automático de custo de aquisição, infra de auditoria e notificações | Módulos 2, 3 |
| **3 — Jurídico & Reforma** | Máquina de estados jurídica com alertas de prazo, Kanban de reforma com checklist/mídia/percentual | Módulos 4, 5 |
| **4 — Financeiro & Caixa** | DRE por imóvel, hierarquia de caixa (geral/empresa/SPE/imóvel), categorias, conciliação | Módulos 6, 9 |
| **5 — Simulador** | Cálculo de ROI, margem, payback, TIR, VPL; cenários Otimista/Realista/Pessimista | Módulo 7 |
| **6 — Investidores** | Cadastro, participações, aportes, cálculo de distribuição de lucro e IR estimado, prestação de contas | Módulo 8 |
| **7 — Vendas** | Pipeline, corretor/comissão, proposta→contrato→financiamento→recebíveis, encerramento automático da operação | Módulo 10 |
| **8 — Relatórios & Painel Executivo** | Exportação PDF/Excel, dashboard de diretoria com mapas/gráficos/comparativos | Transversal |
| **9 — IA & Notificações avançadas** | Assistente com tool-use sobre os dados, motor de notificações (prazos, obras atrasadas, pagamentos) | Módulo IA + Notificações |
| **10 — Hardening & AWS** | RLS no Postgres, testes E2E, 2FA, Terraform para ECS/RDS/S3/CloudFront, observabilidade (Sentry) | Qualidade/Infra |

Cada fase entrega **módulo funcional de ponta a ponta** (API + UI + testes), não apenas back ou front isolado — mantendo o sistema sempre demonstrável.

---

## 12. Próximo Passo

Após sua validação deste documento (ou ajustes que quiser pedir), inicio a **Fase 0**: setup do monorepo, Docker Compose, schema Prisma completo, autenticação e design system base.
