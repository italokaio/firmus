import { NO_STAGE_LABEL, SALE_STATUS_LABELS, type SaleStatus } from "@leilao-erp/types";
import type { ReportContent } from "../report-content.types";
import type { ReportContext } from "./context";
import { monthLabel, monthName } from "./helpers";

const num = (value: unknown) => Number(String(value));

/** Pipeline de vendas, organizado pelas etapas do funil (capital e avaliação por etapa) + tabela de vendas. */
export async function buildSalesPipelineContent(ctx: ReportContext): Promise<ReportContent> {
  const [data, sales] = await Promise.all([
    ctx.dashboardService.getPortfolio(ctx.companyId, undefined, ctx.generatedAt),
    ctx.salesService.listSales(ctx.companyId),
  ]);

  const byStatus = new Map<SaleStatus, { count: number; total: number }>();
  for (const sale of sales) {
    const entry = byStatus.get(sale.status) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += num(sale.valorPedido);
    byStatus.set(sale.status, entry);
  }

  return {
    typeLabel: "Pipeline de vendas",
    title: "Pipeline de vendas",
    subtitle: `${sales.length} venda(s) · ${data.counts.adquiridos} imóvel(is) adquirido(s) em carteira`,
    generatedAt: ctx.generatedAt,
    generatedBy: ctx.generatedBy,
    sections: [
      {
        kind: "table",
        heading: "Funil por etapa",
        sheet: "Funil",
        columns: [
          { label: "Etapa", weight: 3 },
          { label: "Imóveis", format: "integer", weight: 1 },
          { label: "Capital investido", format: "currency" },
          { label: "Avaliação Caixa", format: "currency" },
        ],
        rows: [
          ...data.funnel.map((step) => [step.label, step.count, num(step.capital), num(step.avaliacao)]),
          ...(data.semEtapa.count > 0
            ? [[`${NO_STAGE_LABEL} (adquiridos)`, data.semEtapa.count, num(data.semEtapa.capital), num(data.semEtapa.avaliacao)]]
            : []),
        ],
        footer: [
          "Total",
          data.funnel.reduce((sum, s) => sum + s.count, 0) + data.semEtapa.count,
          data.funnel.reduce((sum, s) => sum + num(s.capital), 0) + num(data.semEtapa.capital),
          data.funnel.reduce((sum, s) => sum + num(s.avaliacao), 0) + num(data.semEtapa.avaliacao),
        ],
      },
      {
        kind: "table",
        heading: "Vendas por status",
        sheet: "Funil",
        columns: [{ label: "Status", weight: 3 }, { label: "Vendas", format: "integer", weight: 1 }, { label: "Valor pedido", format: "currency" }],
        rows: [...byStatus.entries()].map(([status, v]) => [SALE_STATUS_LABELS[status], v.count, v.total]),
      },
      {
        kind: "table",
        heading: "Vendas",
        sheet: "Vendas",
        columns: [
          { label: "Imóvel", weight: 3 },
          { label: "Status", weight: 1.8 },
          { label: "Corretor", weight: 1.8 },
          { label: "Valor pedido", format: "currency" },
          { label: "Início", format: "date" },
          { label: "Conclusão", format: "date" },
        ],
        rows: sales.map((s) => [
          s.property.origem,
          SALE_STATUS_LABELS[s.status],
          s.broker?.name ?? "—",
          num(s.valorPedido),
          s.dataInicio,
          s.dataConclusao ?? null,
        ]),
      },
    ],
  };
}

/** Fluxo de caixa consolidado da empresa (todas as contas), mês a mês. Cancelados já ficam de fora. */
export async function buildCompanyCashflowContent(ctx: ReportContext): Promise<ReportContent> {
  const [summary, cashflow] = await Promise.all([
    ctx.financeService.getSummary(ctx.companyId),
    ctx.financeService.getCompanyCashflow(ctx.companyId),
  ]);
  const currentMonth = ctx.generatedAt.toISOString().slice(0, 7);

  return {
    typeLabel: "Fluxo de caixa geral",
    title: "Fluxo de caixa da empresa",
    subtitle: `Todas as contas (geral, empresa, SPEs e imóveis) · ${monthName(currentMonth)}`,
    generatedAt: ctx.generatedAt,
    generatedBy: ctx.generatedBy,
    sections: [
      {
        kind: "cards",
        cards: [
          { label: "Saldo consolidado", value: num(summary.saldoConsolidado), format: "currency", highlight: true },
          { label: "Receitas realizadas no mês", value: num(summary.totalReceitasMes), format: "currency" },
          { label: "Despesas realizadas no mês", value: num(summary.totalDespesasMes), format: "currency" },
        ],
      },
      {
        kind: "table",
        heading: "Fluxo de caixa mensal consolidado",
        sheet: "Fluxo mensal",
        note: "Meses futuros com valores previstos aparecem em âmbar.",
        columns: [
          { label: "Mês", weight: 1 },
          { label: "Entradas previstas", format: "currency" },
          { label: "Saídas previstas", format: "currency" },
          { label: "Entradas realizadas", format: "currency" },
          { label: "Saídas realizadas", format: "currency" },
          { label: "Saldo acumulado", format: "currency" },
        ],
        rows: cashflow.map((row) => {
          const tone = row.month > currentMonth ? ("forecast" as const) : undefined;
          return [
            { value: monthLabel(row.month), tone },
            { value: num(row.previstoEntradas), tone },
            { value: num(row.previstoSaidas), tone },
            { value: num(row.realizadoEntradas), tone },
            { value: num(row.realizadoSaidas), tone },
            { value: num(row.saldoAcumulado), tone },
          ];
        }),
      },
    ],
  };
}
