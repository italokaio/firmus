# Progresso — Evolução FGI (6 fases)

> Se a sessão for reiniciada, leia este arquivo primeiro e retome do ponto em que parou.

| Fase | Entrega | Status |
|---|---|---|
| 1 | Lançamentos: edição, histórico, "Pago por", Excel | **Concluída e publicada em 28/10/2026** (migrações aplicadas em produção, OK do usuário) |
| 2 | Cancelamento de aquisição | **Concluída e publicada em 29/10/2026** (migração `add_aquisicao_cancelada` aplicada em produção) |
| 3 | Identidade visual Firmus | **Publicada em 29/10/2026** (aguardando conferência visual do usuário) |
| 4 | Novo dashboard | **Publicada em 29/10/2026** (migração `add_etapa_pos_aquisicao` aplicada; aguardando conferência visual) |
| 5 | DRE do imóvel detalhada | **Levantamento feito — aguardando OK do plano** |
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

## Fase 2 — Levantamento (resumo)
- Status do imóvel: enum `ProspectStatus` (NOVA_OPORTUNIDADE, EM_ANALISE, APROVADA, REPROVADA, EM_DUE_DILIGENCE, ADQUIRIDA, VENDIDA, DESCARTADA). Produção: 3 EM_ANALISE, 1 NOVA_OPORTUNIDADE, 4 ADQUIRIDA, 1 REPROVADA.
- `TransactionStatus` só tem PREVISTO e REALIZADO — `CANCELADO` não existe.
- Exclusão de imóvel (`PropertiesService.delete`) apaga em cascata conta de caixa e TODOS os lançamentos (onDelete: Cascade). Confirma o risco que motivou a fase.
- `getCashflow` e `getCompanyCashflow` tratam "não PREVISTO" como realizado: um `CANCELADO` seria somado como realizado se nada for feito. Saldo, DRE e resumo já filtram `REALIZADO` explicitamente (seguros).
- Categorias são por empresa (`@@unique([companyId, name])`) e não existe categoria de reembolso em produção.
- `PropertiesService.update` aceita `status` livre; precisa bloquear AQUISICAO_CANCELADA via PATCH comum e qualquer mudança a partir dela.

## Fase 2 — o que foi feito
- **Migração** `20261029120000_add_aquisicao_cancelada` (só adiciona): valor `AQUISICAO_CANCELADA` em ProspectStatus, `CANCELADO` em TransactionStatus, colunas `canceladoEm`, `canceladoPorId` (FK users, SET NULL), `motivoCancelamento` em properties. **Ainda não aplicada em produção** (aplicar com `prisma migrate deploy` antes do push; há permissão local para esse comando).
- **API**: `POST /properties/:id/cancel-acquisition` (transação única; guarda contra cancelamento duplo concorrente), `GET /properties/:id/cancel-impact`. Permissão: `properties:edit`. Só cancela imóvel ADQUIRIDA.
- **C5/C6**: realizados intactos; PREVISTO → CANCELADO com histórico por lançamento. **C7**: reembolso = receita na categoria "Reembolso de aquisição" (criada por empresa na primeira vez). **C9**: excluir imóvel com lançamento realizado é recusado na API e o botão fica desabilitado (`hasRealizedTransactions` na listagem/detalhe). **C4**: PATCH comum não muda status de imóvel cancelado e não consegue definir AQUISICAO_CANCELADA.
- **Somas**: CANCELADO fora dos dois fluxos de caixa (corrigido o ramo "senão = realizado"), da soma por origem e do saldo/DRE/resumo (já filtravam REALIZADO). Lançamento cancelado é somente leitura (editar/excluir recusado; UI atenua e esconde controles; filtro de status na lista).
- **Frontend**: botão e diálogo "Cancelar aquisição" (motivo, data, devolução opcional, prévia do impacto, confirmação digitando o nome), faixa no imóvel cancelado (data, autor, motivo, resultado realizado/perda), etiqueta "Aquisição cancelada", status oculto na edição de imóvel cancelado.
- **Testes**: 50 no total (19 novos da fase 2).
- **Fora desta fase**: funil/projeção de resultado (Fase 4) — hoje o gráfico por status do dashboard mostra "Aquisição cancelada" como uma barra própria.

## Decisões provisórias da Fase 2 a confirmar
1. Permissão para cancelar = `properties:edit` (quem edita imóveis).
2. Lançamento cancelado é somente leitura e não volta a Previsto.
3. Só imóvel ADQUIRIDA pode ter a aquisição cancelada; os demais usam "Reprovada".
4. Imóvel cancelado continua aceitando novos lançamentos e edição dos realizados (reembolso tardio).


## Fase 3 — Levantamento (resumo)
- Estilo: Tailwind v4 + tokens semânticos estilo shadcn em `apps/web/app/globals.css` (`:root` e `.dark`, valores em oklch, matiz azul-violeta ~260). Nenhum componente usa cor fixa (só `themeColor`/manifest já em #005666) → trocar os tokens reskina o app inteiro.
- Tema: next-themes (classe `.dark`), `defaultTheme="system"`; botão sol/lua no topbar.
- Gráficos: recharts só na página do dashboard, cores via `var(--color-primary|warning|destructive|muted-foreground)`.
- PDF: pdfkit na API (`report-renderers.ts`: Helvetica/Courier, sem layout); Excel: exceljs. Layout de marca é da Fase 6; a Fase 3 entrega tokens + fonte + logo para o PDF.
- Logos: já no repositório (`apps/web/public/firmus-logo-dark.png` = wordmark branco + detalhe ciano; `firmus-logo-light.png` = petróleo). Poppins (OFL) baixável de github.com/google/fonts (4 pesos).
- Contraste medido nas cores especificadas: escuro passa em tudo (mín. 5,16); claro/impressão: previsto #C98A1C = 2,94, cancelado #7FA4AB = 2,69 (falham como texto); branco sobre ciano #0097B2 = 3,46 (falha). Ajustes propostos no plano.
- Sidebar mostra o texto de desenvolvimento "Fase 8 · Relatórios" no rodapé.


## Fase 3 — o que foi feito
- **Tokens** em `apps/web/app/globals.css` (única fonte das cores): marca (petróleo/ciano/branco), tema escuro (padrão) e claro com os valores da especificação, semânticas (previsto/realizado/negativo/cancelado), `accent-text`, paleta de gráficos `chart-1..5`. `success`→realizado e `warning`→previsto (não há verde na paleta).
- **Tipografia**: Poppins 400/500/600/700 via next/font; `tabular-nums` no app todo. **Tema padrão = escuro** (quem já escolheu no botão mantém).
- **Componentes**: `KpiCard` (variante `highlight` petróleo + borda ciano), `StatusPill` (tons neutral/info/forecast/realized/negative/cancelled), variantes de Badge. Dashboard usa KpiCard (Saldo consolidado em destaque) e a paleta de gráficos; `StatCard` removido. Status do imóvel e dos lançamentos usam StatusPill (previsto âmbar, realizado ciano/petróleo, cancelado atenuado). Menu: item ativo petróleo/branco; texto de dev "Fase 8 · Relatórios" removido da sidebar.
- **Tema de impressão**: `PRINT_THEME` + `contrastRatio` em `packages/types/src/print-theme.ts`; Poppins (4 TTF + licença OFL) e logos (branco/petróleo) em `apps/api/assets`; `registerPrintFonts` em `apps/api/src/modules/reports/print-theme.ts`. Os relatórios atuais NÃO mudaram de aparência (layout é da Fase 6).
- **Verificação**: `pnpm --filter @leilao-erp/web check:theme` (contraste dos 2 temas + nenhuma cor literal fora dos tokens); testes do tema de impressão (contraste ≥ 4,5, PDF com Poppins embutida). Total de testes da API: 75. Build de produção do site OK.

## Ajustes de cor feitos para passar em 4,5:1 (desvios da especificação)
| Onde | Especificado | Usado | Motivo |
|---|---|---|---|
| Botão primário, tema claro | ciano #0097B2 c/ texto branco | fundo #00798F | branco/#0097B2 = 3,46 |
| Botão primário, tema escuro | — | #0097B2 c/ texto #04222A | 4,79 |
| Previsto (texto), claro | #C98A1C | #926100 (preenchimento segue #C98A1C) | 2,94 → 5,3 |
| Cancelado (texto), claro | #7FA4AB | #4F6E74 (preenchimento segue #7FA4AB) | 2,69 → 5,5 |
| Cancelado (texto), escuro | #7FA4AB | #84A9B0 | 4,45 sobre superfície-2 |
| Ciano claro do PDF sobre a faixa petróleo | #4FC6DC (sugerido) | #62CFE3 | 4,14 → 4,58 |
| Gráfico série 5, escuro | petróleo #005666 | #2A8FA3 | petróleo some sobre a superfície (1,67:1) |
- Aceito sem ajuste (só elementos gráficos, tema claro): série 2 (#4FC6DC) ≈ 2,0:1 e série 3 (#C98A1C) 2,94:1 sobre branco — vêm da paleta da marca e têm legenda/tooltip.

## Para conferir visualmente (não consegui ver a tela)
Login, Dashboard (tema escuro e claro), lista e detalhe de imóvel, aba Financeiro (etiquetas Previsto/Realizado/Cancelado), diálogo de cancelamento, Caixa, Relatórios, Usuários/Papéis.


## Publicação das Fases 2 e 3 (29/10/2026)
Backup `C:devackups-firmusirmus-prod-20261029-0419-pre-fase2-3.json`; `prisma migrate deploy` aplicou 20261029120000_add_aquisicao_cancelada (15 migrações ok, 32 lançamentos intactos); push `cdffb93`; API (Railway) SUCCESS; site (Vercel) já com Poppins.

## Fase 4 — Levantamento (resumo)
- **Cards atuais**: Imóveis em prospecção = `propertiesCount` (conta TODOS os imóveis da empresa; por isso mostra 6 = 3 adquiridos + 2 em análise + 1 reprovado). Usuários/Papéis são administrativos.
- **Avaliação Caixa** = `Property.valorAvaliacao` (obrigatório). Em produção nenhum imóvel está sem avaliação; um da empresa demo tem valor 1 (R$ 1,00).
- **P2**: aportes de investidores (`PropertyInvestor.valorAporte`) NÃO geram lançamento no Caixa (o módulo de investidores não toca em transações); hoje há 0 participações. Saldo consolidado = saldo inicial + realizados e continua assim.
- **P3**: não existe status/etapa pós-aquisição. Existem estados paralelos: `LegalCase.status` (AGUARDANDO_PAGAMENTO…DESOCUPADO), tarefas de reforma por `RenovationStage`, `Sale.status`, e `Property.status` = ADQUIRIDA/VENDIDA. Criar `etapaPosAquisicao` (opcional, sem preenchimento automático).
- **Data de aquisição NÃO existe**: `Acquisition` só tem `createdAt` (data do registro). Ex.: F 201 tem gastos desde fevereiro mas o registro é de 25/08. "Dias em carteira" pela data do registro seria enganoso.
- **Dados de conferência**: F 201 despesas realizadas R$ 57.260,00 ✓; H 02 R$ 57.800,00 ✓; B 102 R$ 64.000,76. Não há nenhum lançamento PREVISTO em produção → "custos até a venda" = R$ 0,00 hoje.
- **Alertas com dado real hoje**: processo jurídico aguardando pagamento (3), lançamentos sem "Pago por", adquiridos sem etapa. Sem dado hoje (entram quando existirem): prazos/audiências (0 eventos), orçamento de reforma (todos os valores 0), parcelas de venda.
- Valores esperados (empresa Firmus) para conferir após a implementação: capital investido R$ 179.060,76; avaliação R$ 373.000,00; resultado projetado R$ 193.939,24; margem ≈ 52,0%; ROI ≈ 108,3%.


## Fase 4 — o que foi feito
- **Migração** `20261029180000_add_etapa_pos_aquisicao` (só adiciona): enum `PostAcquisitionStage`, `properties.etapaPosAquisicao` (opcional, manual), `acquisitions.dataAquisicao` (opcional). **Ainda não aplicada em produção.**
- **API**: `GET /dashboard/portfolio?month=AAAA-MM` (`DASHBOARD_VIEW`; o `/dashboard/summary` antigo continua existindo, sem uso). Cálculos em funções puras (`portfolio-metrics.ts`): R2 custo incorrido, R3 custos até a venda, R4 resultado projetado, margem, ROI, funil, caixa do mês, saídas previstas 90 dias, origem do capital, alertas.
- **Decisões aplicadas**: margem = resultado ÷ avaliação; ROI = resultado ÷ (custo + previstos); "adquiridos" = status ADQUIRIDA (vendidos só no funil, fora da projeção); cancelados/reprovados fora do funil e da projeção (só contagem; cancelados mostram o resultado realizado); sem avaliação (nula ou 0) fora da projeção, sinalizado, mas o dinheiro gasto conta no capital investido; lançamentos CANCELADO fora de tudo; dashboard continua por empresa (sem escopo por usuário); aportes registrados só informativos (não entram no saldo — P2); P1 desligada.
- **Dias em carteira**: só com a "Data da aquisição" (campo novo, opcional, na aba Aquisição); sem data mostra "—". Nunca estimado.
- **Frontend**: seletor de mês, "Gerar relatório" (Resumo do portfólio em PDF), 4 KPIs (Saldo consolidado saiu; Resultado projetado em destaque), funil, cascata da projeção, caixa, origem do capital, tabela de adquiridos ordenável (rolagem horizontal no celular) e alertas. Removidos: usuários ativos, papéis, gráfico por prioridade (virou coluna), "Próximos módulos". Menu agrupado em Operação / Financeiro / Administração. Etapa pós-aquisição editável no formulário do imóvel (quando Adquirida).
- **Alertas** (só com dado real): prazos/audiências vencidos e próximos 7 dias, tarefas de reforma atrasadas, reforma acima do orçamento, parcelas de venda vencidas, previstos com data vencida, processos aguardando pagamento, adquiridos sem avaliação/sem etapa, despesas sem "Pago por".
- **Testes**: 96 na API (21 novos do dashboard). Conferência com dados reais da Firmus (a partir do backup): capital R$ 179.060,76; avaliação R$ 373.000,00; resultado R$ 193.939,24; margem 51,99%; ROI 108,31%; F 201 custo R$ 57.260,00. Build de produção OK.


## Publicação da Fase 4 (29/10/2026)
Backup `firmus-prod-20261029-0450-pre-fase4.json`; `migrate deploy` aplicou 20261029180000_add_etapa_pos_aquisicao (16 migrações ok, 32 lançamentos intactos); push `6e8f82d`; API SUCCESS.

## Fase 5 — Levantamento (resumo)
- A "DRE" é a aba **Financeiro** do imóvel (`finance-tab.tsx`): cards de saldo/receitas/despesas, bloco "DRE (receitas x despesas realizadas)" com "Lucro líquido" e "Margem", fluxo mensal e o painel de lançamentos. Não existe página própria.
- "Margem" fica vazia porque `getDre` calcula lucro ÷ **receitas** (null sem receita) — todo imóvel não vendido. "Lucro líquido" negativo = só despesas realizadas.
- Fluxo mensal: o previsto aparece zerado porque **não há nenhum lançamento previsto** em produção (não é bug de cálculo). Cancelados já ficam fora (Fase 2).
- Lançamento **não tem fornecedor nem comprovante** — colunas só com o que existe (Data, Descrição, Pago por, Status, Conciliado, Valor).
- Orçamento de reforma: `RenovationTask.valorPrevisto/valorRealizado` existe (módulo Reforma, manual, hoje tudo 0), sem vínculo com categorias financeiras.
- Categorias são nomes livres por empresa: "Aquisição de imóvel" e "Compra imóvel", "Reforma" e "Reforma de imóvel", "Impostos", "Documentação de imóvel". Não há campo que diga qual é "a categoria Aquisição/Reforma".
- Dados de conferência confirmados no backup — F 201: Aquisição 38.000 (66,4%), Impostos 10.560 (18,4%), Reforma 8.100 (14,1%), Documentação 600 (1,0%); meses fev 45.200, mar 600, jun 6.650, jul 1.450, out 3.360 = 57.260. H 02: 57.800 em out/2026 (1 lançamento).
- Reaproveitável: `sumByOrigin`, `projectedResult/marginPercent/roiPercent` (portfolio-metrics), edição/histórico de lançamentos (hoje dentro do transactions-panel), `ProjectionWaterfall`, export Excel (`/finance/transactions/export?propertyId`), relatório FINANCIAL_DRE (PDF simples; layout de marca é Fase 6).

