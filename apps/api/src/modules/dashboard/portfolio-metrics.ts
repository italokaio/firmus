import { Prisma } from "@prisma/client";
import {
  FUNNEL_STEPS,
  FUNNEL_STEP_LABELS,
  type FunnelStepDto,
  type FunnelStepKey,
  type PortfolioCancelledRowDto,
  type PortfolioAcquiredRowDto,
  type PortfolioAlertDto,
  type PortfolioDashboardDto,
  type PostAcquisitionStage,
  type Priority,
  type ProspectStatus,
  type TransactionOrigemTipo,
} from "@leilao-erp/types";
import { isReimbursementCategory, sumByOrigin } from "../finance/transaction-rules";

const DAY_MS = 24 * 60 * 60 * 1000;
const ZERO = new Prisma.Decimal(0);

/** Status que o funil agrupa em "Em análise" (ainda não adquiridos). */
const EM_ANALISE_STATUSES: readonly ProspectStatus[] = [
  "NOVA_OPORTUNIDADE",
  "EM_ANALISE",
  "APROVADA",
  "EM_DUE_DILIGENCE",
];
/** Reprovados e descartados: só aparecem como contagem informativa. */
const REPROVADO_STATUSES: readonly ProspectStatus[] = ["REPROVADA", "DESCARTADA"];

export interface MetricProperty {
  id: string;
  origem: string;
  status: ProspectStatus;
  prioridade: Priority;
  /** Avaliação Caixa. Nulo ou zero = "sem avaliação" (nunca tratado como zero em projeção). */
  avaliacao: Prisma.Decimal | string | null;
  etapa: PostAcquisitionStage | null;
  dataAquisicao: Date | null;
  /** Só preenchido quando a aquisição foi cancelada. */
  canceladoEm?: Date | null;
}

export interface MetricTransaction {
  /** Imóvel dono da conta de caixa; nulo para contas gerais, da empresa ou de SPE. */
  propertyId: string | null;
  amount: Prisma.Decimal | string;
  status: "PREVISTO" | "REALIZADO" | "CANCELADO";
  date: Date;
  categoryType: "RECEITA" | "DESPESA";
  /** Nome da categoria (reconhece reembolsos de aquisição cancelada). */
  categoryName?: string;
  origemTipo: TransactionOrigemTipo | null;
  investidorId: string | null;
  investidorName: string | null;
}

export interface PortfolioExtras {
  saldoConsolidado: string;
  aportesRegistrados: string;
}

const dec = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value);
const money = (value: Prisma.Decimal) => value.toFixed(2);

/** Margem = resultado ÷ avaliação Caixa (P4, proposta confirmada). Nulo sem avaliação. */
export function marginPercent(resultado: Prisma.Decimal, avaliacao: Prisma.Decimal): Prisma.Decimal | null {
  return avaliacao.greaterThan(0) ? resultado.dividedBy(avaliacao).times(100) : null;
}

/** ROI = resultado ÷ (custo incorrido + custos até a venda) (P4). Nulo sem capital empregado. */
export function roiPercent(resultado: Prisma.Decimal, capitalEmpregado: Prisma.Decimal): Prisma.Decimal | null {
  return capitalEmpregado.greaterThan(0) ? resultado.dividedBy(capitalEmpregado).times(100) : null;
}

/** Resultado projetado = avaliação Caixa − custo incorrido − custos até a venda (R4). */
export function projectedResult(
  avaliacao: Prisma.Decimal,
  custoIncorrido: Prisma.Decimal,
  custosAteVenda: Prisma.Decimal,
): Prisma.Decimal {
  return avaliacao.minus(custoIncorrido).minus(custosAteVenda);
}

export function currentMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year!, mon! - 1, 1)), end: new Date(Date.UTC(year!, mon!, 1)) };
}

function hasAvaliacao(property: MetricProperty): boolean {
  return property.avaliacao !== null && dec(property.avaliacao).greaterThan(0);
}

interface PropertyTotals {
  despesaRealizada: Prisma.Decimal; // R2 — custo incorrido
  receitaRealizada: Prisma.Decimal;
  despesaPrevista: Prisma.Decimal; // R3 — custos até a venda
  reembolsos: Prisma.Decimal; // receitas realizadas na categoria de reembolso
}

export function computePortfolio(
  properties: MetricProperty[],
  transactions: MetricTransaction[],
  extras: PortfolioExtras,
  options: { month?: string; now: Date },
): PortfolioDashboardDto {
  const { now } = options;
  const month = options.month ?? currentMonth(now);

  // Lançamentos CANCELADO não entram em nenhuma soma (Fase 2).
  const live = transactions.filter((tx) => tx.status !== "CANCELADO");

  const totals = new Map<string, PropertyTotals>();
  const totalsOf = (propertyId: string): PropertyTotals => {
    let entry = totals.get(propertyId);
    if (!entry) {
      entry = { despesaRealizada: ZERO, receitaRealizada: ZERO, despesaPrevista: ZERO, reembolsos: ZERO };
      totals.set(propertyId, entry);
    }
    return entry;
  };
  for (const tx of live) {
    if (!tx.propertyId) continue;
    const entry = totalsOf(tx.propertyId);
    const amount = dec(tx.amount);
    if (tx.status === "REALIZADO" && tx.categoryType === "DESPESA") entry.despesaRealizada = entry.despesaRealizada.plus(amount);
    else if (tx.status === "REALIZADO" && tx.categoryType === "RECEITA") {
      entry.receitaRealizada = entry.receitaRealizada.plus(amount);
      if (tx.categoryName && isReimbursementCategory(tx.categoryName)) entry.reembolsos = entry.reembolsos.plus(amount);
    }
    else if (tx.status === "PREVISTO" && tx.categoryType === "DESPESA") entry.despesaPrevista = entry.despesaPrevista.plus(amount);
  }
  const of = (property: MetricProperty): PropertyTotals =>
    totals.get(property.id) ?? { despesaRealizada: ZERO, receitaRealizada: ZERO, despesaPrevista: ZERO, reembolsos: ZERO };

  const adquiridos = properties.filter((p) => p.status === "ADQUIRIDA");
  const cancelados = properties.filter((p) => p.status === "AQUISICAO_CANCELADA");

  // ---------- Funil ----------
  const stepAcc = new Map<FunnelStepKey, { count: number; capital: Prisma.Decimal; avaliacao: Prisma.Decimal }>(
    FUNNEL_STEPS.map((key) => [key, { count: 0, capital: ZERO, avaliacao: ZERO }]),
  );
  const semEtapa = { count: 0, capital: ZERO, avaliacao: ZERO };
  const avaliacaoOf = (property: MetricProperty) => (hasAvaliacao(property) ? dec(property.avaliacao!) : ZERO);
  for (const property of properties) {
    const capital = of(property).despesaRealizada;
    let key: FunnelStepKey | null = null;
    if (EM_ANALISE_STATUSES.includes(property.status)) key = "EM_ANALISE";
    else if (property.status === "VENDIDA") key = "VENDIDO";
    else if (property.status === "ADQUIRIDA") {
      if (property.etapa) key = property.etapa;
      else {
        semEtapa.count += 1;
        semEtapa.capital = semEtapa.capital.plus(capital);
        semEtapa.avaliacao = semEtapa.avaliacao.plus(avaliacaoOf(property));
        continue;
      }
    }
    if (!key) continue; // reprovados e cancelados ficam fora do funil (R6)
    const acc = stepAcc.get(key)!;
    acc.count += 1;
    acc.capital = acc.capital.plus(capital);
    acc.avaliacao = acc.avaliacao.plus(avaliacaoOf(property));
  }
  const funnel: FunnelStepDto[] = FUNNEL_STEPS.map((key) => ({
    key,
    label: FUNNEL_STEP_LABELS[key],
    count: stepAcc.get(key)!.count,
    capital: money(stepAcc.get(key)!.capital),
    avaliacao: money(stepAcc.get(key)!.avaliacao),
  }));

  // ---------- Carteira / projeção (só adquiridos; R6 e R7) ----------
  const capitalInvestido = adquiridos.reduce((sum, p) => sum.plus(of(p).despesaRealizada), ZERO);
  const naProjecao = adquiridos.filter(hasAvaliacao);
  const avaliacao = naProjecao.reduce((sum, p) => sum.plus(dec(p.avaliacao!)), ZERO);
  const custoIncorrido = naProjecao.reduce((sum, p) => sum.plus(of(p).despesaRealizada), ZERO);
  const custosAteVenda = naProjecao.reduce((sum, p) => sum.plus(of(p).despesaPrevista), ZERO);
  const resultadoProjetado = projectedResult(avaliacao, custoIncorrido, custosAteVenda);
  const margem = marginPercent(resultadoProjetado, avaliacao);
  const roi = roiPercent(resultadoProjetado, custoIncorrido.plus(custosAteVenda));

  // ---------- Caixa (empresa inteira, todas as contas) ----------
  const { start, end } = monthBounds(month);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in90Days = new Date(today.getTime() + 90 * DAY_MS);
  let receitasMes = ZERO;
  let despesasMes = ZERO;
  let saidasPrevistas = ZERO;
  for (const tx of live) {
    const amount = dec(tx.amount);
    if (tx.status === "REALIZADO" && tx.date >= start && tx.date < end) {
      if (tx.categoryType === "RECEITA") receitasMes = receitasMes.plus(amount);
      else despesasMes = despesasMes.plus(amount);
    }
    if (tx.status === "PREVISTO" && tx.categoryType === "DESPESA" && tx.date >= today && tx.date <= in90Days) {
      saidasPrevistas = saidasPrevistas.plus(amount);
    }
  }

  // ---------- Origem do capital: despesas realizadas dos adquiridos por "Pago por" ----------
  const adquiridoIds = new Set(adquiridos.map((p) => p.id));
  const origemCapital = sumByOrigin(
    live
      .filter((tx) => tx.propertyId && adquiridoIds.has(tx.propertyId) && tx.status === "REALIZADO" && tx.categoryType === "DESPESA")
      .map((tx) => ({
        amount: tx.amount,
        origemTipo: tx.origemTipo,
        investidorId: tx.investidorId,
        investidorName: tx.investidorName,
      })),
  );

  // ---------- Tabela de adquiridos ----------
  const rows: PortfolioAcquiredRowDto[] = adquiridos
    .map((property) => {
      const t = of(property);
      const withAval = hasAvaliacao(property);
      const aval = withAval ? dec(property.avaliacao!) : null;
      const resultado = aval ? projectedResult(aval, t.despesaRealizada, t.despesaPrevista) : null;
      return {
        id: property.id,
        origem: property.origem,
        prioridade: property.prioridade,
        etapa: property.etapa,
        dataAquisicao: property.dataAquisicao ? property.dataAquisicao.toISOString() : null,
        diasEmCarteira: property.dataAquisicao
          ? Math.max(0, Math.floor((now.getTime() - property.dataAquisicao.getTime()) / DAY_MS))
          : null,
        custoIncorrido: money(t.despesaRealizada),
        avaliacao: aval ? money(aval) : null,
        resultadoProjetado: resultado ? money(resultado) : null,
        margemPercentual: resultado && aval ? marginPercent(resultado, aval)?.toFixed(4) ?? null : null,
        semAvaliacao: !withAval,
      };
    })
    .sort((a, b) => a.origem.localeCompare(b.origem, "pt-BR"));

  const canceladosResultado = cancelados.reduce(
    (sum, p) => sum.plus(of(p).receitaRealizada).minus(of(p).despesaRealizada),
    ZERO,
  );

  return {
    month,
    counts: {
      cadastrados: properties.length,
      emAnalise: properties.filter((p) => EM_ANALISE_STATUSES.includes(p.status)).length,
      adquiridos: adquiridos.length,
      vendidos: properties.filter((p) => p.status === "VENDIDA").length,
      reprovados: properties.filter((p) => REPROVADO_STATUSES.includes(p.status)).length,
      cancelados: cancelados.length,
    },
    canceladosResultadoRealizado: money(canceladosResultado),
    funnel,
    semEtapa: { count: semEtapa.count, capital: money(semEtapa.capital), avaliacao: money(semEtapa.avaliacao) },
    cancelados: cancelados
      .map((p): PortfolioCancelledRowDto => {
        const t = of(p);
        return {
          id: p.id,
          origem: p.origem,
          canceladoEm: p.canceladoEm ? p.canceladoEm.toISOString() : null,
          capitalInvestido: money(t.despesaRealizada),
          reembolsos: money(t.reembolsos),
          resultadoRealizado: money(t.receitaRealizada.minus(t.despesaRealizada)),
        };
      })
      .sort((a, b) => a.origem.localeCompare(b.origem, "pt-BR")),
    carteira: {
      capitalInvestido: money(capitalInvestido),
      avaliacao: money(avaliacao),
      custoIncorrido: money(custoIncorrido),
      custosAteVenda: money(custosAteVenda),
      resultadoProjetado: money(resultadoProjetado),
      margemPercentual: margem ? margem.toFixed(4) : null,
      roiPercentual: roi ? roi.toFixed(4) : null,
      imoveisNaProjecao: naProjecao.length,
      imoveisSemAvaliacao: adquiridos.length - naProjecao.length,
    },
    caixa: {
      saldoConsolidado: extras.saldoConsolidado,
      receitasRealizadasMes: money(receitasMes),
      despesasRealizadasMes: money(despesasMes),
      saidasPrevistas90Dias: money(saidasPrevistas),
      aportesRegistrados: extras.aportesRegistrados,
    },
    origemCapital,
    adquiridos: rows,
    alertas: [],
  };
}

// ---------- Pendências e alertas (só com dado real) ----------

export interface AlertInputs {
  now: Date;
  /** Imóveis adquiridos, para os alertas de cadastro incompleto. */
  adquiridos: Array<Pick<MetricProperty, "id" | "origem" | "etapa"> & { semAvaliacao: boolean }>;
  legalCasesAguardandoPagamento: Array<{ propertyId: string }>;
  legalEventsPendentes: Array<{ propertyId: string; dueDate: Date }>;
  renovationTasks: Array<{
    propertyId: string;
    dueDate: Date | null;
    percentualConcluido: number;
    valorPrevisto: Prisma.Decimal | string;
    valorRealizado: Prisma.Decimal | string;
  }>;
  receivablesPendentes: Array<{ propertyId: string; dataVencimento: Date }>;
  /** Despesas realizadas dos adquiridos sem "Pago por". */
  lancamentosSemOrigem: Array<{ propertyId: string }>;
  previstosVencidos: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const unique = (ids: string[]) => [...new Set(ids)];

export function buildAlerts(input: AlertInputs): PortfolioAlertDto[] {
  const { now } = input;
  const alerts: PortfolioAlertDto[] = [];
  const add = (id: string, tone: PortfolioAlertDto["tone"], count: number, message: string, propertyIds: string[]) => {
    if (count > 0) alerts.push({ id, tone, count, message, propertyIds: unique(propertyIds) });
  };

  const overdueEvents = input.legalEventsPendentes.filter((e) => e.dueDate < now);
  add("legal-overdue", "negative", overdueEvents.length, `${plural(overdueEvents.length, "prazo/audiência jurídica vencida", "prazos/audiências jurídicas vencidos")}`, overdueEvents.map((e) => e.propertyId));

  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
  const soonEvents = input.legalEventsPendentes.filter((e) => e.dueDate >= now && e.dueDate <= weekAhead);
  add("legal-soon", "forecast", soonEvents.length, `${plural(soonEvents.length, "prazo/audiência jurídica nos próximos 7 dias", "prazos/audiências jurídicas nos próximos 7 dias")}`, soonEvents.map((e) => e.propertyId));

  const lateTasks = input.renovationTasks.filter((t) => t.dueDate && t.dueDate < now && t.percentualConcluido < 100);
  add("renovation-late", "negative", lateTasks.length, `${plural(lateTasks.length, "tarefa de reforma atrasada", "tarefas de reforma atrasadas")}`, lateTasks.map((t) => t.propertyId));

  const overBudgetProperties = unique(
    input.renovationTasks
      .filter((t) => dec(t.valorPrevisto).greaterThan(0) && dec(t.valorRealizado).greaterThan(dec(t.valorPrevisto)))
      .map((t) => t.propertyId),
  );
  add("renovation-budget", "negative", overBudgetProperties.length, `${plural(overBudgetProperties.length, "imóvel com reforma acima do orçamento", "imóveis com reforma acima do orçamento")}`, overBudgetProperties);

  const lateReceivables = input.receivablesPendentes.filter((r) => r.dataVencimento < now);
  add("receivables-late", "negative", lateReceivables.length, `${plural(lateReceivables.length, "parcela de venda vencida", "parcelas de venda vencidas")}`, lateReceivables.map((r) => r.propertyId));

  add("previstos-overdue", "forecast", input.previstosVencidos, `${plural(input.previstosVencidos, "lançamento previsto com data vencida", "lançamentos previstos com data vencida")}`, []);

  add("legal-payment", "forecast", input.legalCasesAguardandoPagamento.length, `${plural(input.legalCasesAguardandoPagamento.length, "processo jurídico aguardando pagamento", "processos jurídicos aguardando pagamento")}`, input.legalCasesAguardandoPagamento.map((c) => c.propertyId));

  const semAvaliacao = input.adquiridos.filter((p) => p.semAvaliacao);
  add("sem-avaliacao", "info", semAvaliacao.length, `${plural(semAvaliacao.length, "adquirido sem avaliação Caixa (fora da projeção)", "adquiridos sem avaliação Caixa (fora da projeção)")}`, semAvaliacao.map((p) => p.id));

  const semEtapa = input.adquiridos.filter((p) => !p.etapa);
  add("sem-etapa", "info", semEtapa.length, `${plural(semEtapa.length, "adquirido sem etapa definida", "adquiridos sem etapa definida")}`, semEtapa.map((p) => p.id));

  add("sem-origem", "info", input.lancamentosSemOrigem.length, `${plural(input.lancamentosSemOrigem.length, "despesa realizada sem “Pago por”", "despesas realizadas sem “Pago por”")}`, input.lancamentosSemOrigem.map((l) => l.propertyId));

  return alerts;
}
