# Progresso — Evolução FGI (6 fases)

> Se a sessão for reiniciada, leia este arquivo primeiro e retome do ponto em que parou.

| Fase | Entrega | Status |
|---|---|---|
| 1 | Lançamentos: edição, histórico, "Pago por", Excel | **Implementada e commitada — aguardando OK final** (não publicada) |
| 2 | Cancelamento de aquisição | Pendente |
| 3 | Identidade visual Firmus | Pendente |
| 4 | Novo dashboard | Pendente |
| 5 | DRE do imóvel detalhada | Pendente |
| 6 | Relatórios com a marca | Pendente |

## Decisões e respostas do usuário
- Plano da Fase 1 aprovado ("Ok vamos seguir então!").
- Commits separados antes da fase: correção do armazenamento (R2) e relatório "Fluxo de caixa geral" (mantido como 7º relatório; na Fase 2 deve ignorar lançamentos cancelados e na Fase 6 ganhar o layout da marca).
- Backup de produção (JSON, 40 tabelas) em `C:\dev\backups-firmus\`. Refazer antes de publicar as Fases 1 e 2.
- Produção: API + Postgres no Railway (projeto `zealous-surprise`), web na Vercel, arquivos no Cloudflare R2.

## Pendências de negócio
| ID | Status |
|---|---|
| P1 | Aberta — provisório: corretagem/IR desligados |
| P2 | Aberta — investigar na fase 4 |
| P3 | Aberta — investigar na fase 4 |
| P4 | Aberta — fórmulas propostas na fase 4 |
| P5 | Já existe regra: `ProfitDistribution` = lucro base × percentual da participação (IR 15% padrão). Usar na fase 6 |
| P6 | Resolvida provisoriamente: "Conciliar" só marca `conciliado`/`conciliadoEm` e é reversível. Conciliado: edita descrição, categoria e "Pago por"; valor, data e status travados |
| P7 | Provisório: opção única "Caixa da empresa" (`origemTipo=EMPRESA`); `contaOrigemId` reservado e sem uso |

## Fase 1 — o que foi feito
- **Migração** `20261028230000_add_transaction_origem` (só adiciona; nada existente é alterado): enum `TransactionOrigemTipo`, colunas `origemTipo`, `investidorId` (FK → investors, SET NULL), `contaOrigemId` em `transactions`. Lançamentos antigos ficam com origem vazia ("Não informado").
- **Histórico**: reaproveita `audit_logs` (uma linha por campo alterado, gravada na mesma transação da edição; `AuditService.log` aceita `client`). Registros antigos (status/conciliação) também aparecem.
- **API**: `PATCH` completo (já existia, agora valida e audita); `GET .../transactions/:id/history` (conta e imóvel); `GET /finance/transactions/export` (Excel); `GET /finance/transactions/origin-totals` (soma de despesas por origem, base das fases 4–6).
- **Regras**: valor > 0; nova categoria precisa ter o mesmo tipo (receita/despesa) do lançamento; investidor precisa existir na empresa; P6.
- **Frontend** (`TransactionsPanel`, usado em Caixa e na aba Financeiro do imóvel): botão editar (diálogo), "Pago por" no lançar e no editar, origem na linha, "Ver histórico", "Exportar Excel".
- **Testes**: 31 (regras, serviço com banco simulado, Excel). Config Jest criada em `apps/api/jest.config.js`.
- **Bug corrigido de passagem**: datas dos lançamentos (gravadas à meia-noite UTC) apareciam com 1 dia a menos no Brasil na lista de lançamentos. Corrigido só nessa lista (`formatCalendarDate`); outras telas que usam `formatDate` com essas datas ainda podem mostrar o dia anterior.

## Decisões provisórias a confirmar
1. Trocar a categoria de um lançamento só é permitido para categorias do mesmo tipo (despesa→despesa).
2. Em lançamento conciliado, não dá para desfazer a conciliação e editar valor/data/status na mesma ação (desfaz primeiro, depois edita).
3. Excel: o filtro de origem aceita `EMPRESA`, `NAO_INFORMADO` ou id de investidor; a tela de exportação aplica só o filtro do imóvel (aba do imóvel) ou da conta (Caixa).
