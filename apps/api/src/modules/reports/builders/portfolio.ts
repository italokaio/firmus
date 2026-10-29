import {
  NO_STAGE_LABEL,
  POST_ACQUISITION_STAGE_LABELS,
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
} from "@leilao-erp/types";
import type { ReportContent, ReportSection } from "../report-content.types";
import { formatBRL, formatPercentBR } from "../report-format";
import type { ReportContext } from "./context";
import { monthName } from "./helpers";

const pct = (value: string | null) => (value === null ? "—" : formatPercentBR(Number(value)));

/** Resumo do portfólio — espelha o dashboard e termina com a lista completa de imóveis. */
export async function buildPortfolioContent(ctx: ReportContext): Promise<ReportContent> {
  const [data, properties] = await Promise.all([
    ctx.dashboardService.getPortfolio(ctx.companyId, undefined, ctx.generatedAt),
    ctx.prisma.property.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: "desc" } }),
  ]);
  const { carteira, caixa, counts } = data;

  const sections: ReportSection[] = [
    {
      kind: "cards",
      cards: [
        {
          label: "Imóveis adquiridos",
          value: counts.adquiridos,
          format: "integer",
          subtitle: `de ${counts.cadastrados} cadastrados · ${counts.emAnalise} em análise`,
        },
        { label: "Capital investido", value: Number(carteira.capitalInvestido), format: "currency", subtitle: "Despesas realizadas nos adquiridos" },
        {
          label: "Avaliação Caixa da carteira",
          value: Number(carteira.avaliacao),
          format: "currency",
          subtitle:
            carteira.imoveisSemAvaliacao > 0
              ? `${carteira.imoveisNaProjecao} imóvel(is) · ${carteira.imoveisSemAvaliacao} sem avaliação`
              : `${carteira.imoveisNaProjecao} imóvel(is)`,
        },
        {
          label: "Resultado projetado",
          value: Number(carteira.resultadoProjetado),
          format: "currency",
          highlight: true,
          subtitle: `Margem ${pct(carteira.margemPercentual)} · ROI ${pct(carteira.roiPercentual)}`,
        },
      ],
    },
    {
      kind: "table",
      heading: "Funil da carteira",
      columns: [
        { label: "Etapa", weight: 3 },
        { label: "Imóveis", format: "integer", weight: 1 },
        { label: "Capital investido", format: "currency" },
        { label: "Avaliação Caixa", format: "currency" },
      ],
      rows: [
        ...data.funnel.map((step) => [step.label, step.count, Number(step.capital), Number(step.avaliacao)]),
        ...(data.semEtapa.count > 0
          ? [[`${NO_STAGE_LABEL} (adquiridos)`, data.semEtapa.count, Number(data.semEtapa.capital), Number(data.semEtapa.avaliacao)]]
          : []),
      ],
      note: `Reprovados: ${counts.reprovados} · Aquisições canceladas: ${counts.cancelados} (fora do funil e da projeção).`,
    },
    {
      kind: "waterfall",
      heading: "Projeção de resultado da carteira",
      steps: [
        { label: "Avaliação Caixa", value: Number(carteira.avaliacao) },
        { label: "Custo incorrido", value: -Number(carteira.custoIncorrido), tone: "realized" },
        { label: "Custos até a venda", value: -Number(carteira.custosAteVenda), tone: "forecast" },
        { label: "Resultado projetado", value: Number(carteira.resultadoProjetado), total: true },
      ],
    },
    {
      kind: "kv",
      heading: "Projeção de resultado da carteira",
      pdf: false,
      rows: [
        { label: "Avaliação Caixa", value: Number(carteira.avaliacao), format: "currency" },
        { label: "(−) Custo incorrido", value: -Number(carteira.custoIncorrido), format: "currency" },
        { label: "(−) Custos até a venda", value: -Number(carteira.custosAteVenda), format: "currency" },
        { label: "= Resultado projetado", value: Number(carteira.resultadoProjetado), format: "currency" },
        { label: "Margem", value: carteira.margemPercentual === null ? null : Number(carteira.margemPercentual), format: "percent" },
        { label: "ROI", value: carteira.roiPercentual === null ? null : Number(carteira.roiPercentual), format: "percent" },
      ],
    },
    {
      kind: "kv",
      heading: `Caixa — ${monthName(data.month)}`,
      rows: [
        { label: "Saldo consolidado (empresa inteira)", value: Number(caixa.saldoConsolidado), format: "currency", tone: Number(caixa.saldoConsolidado) < 0 ? "negative" : undefined },
        { label: "Receitas realizadas no mês", value: Number(caixa.receitasRealizadasMes), format: "currency" },
        { label: "Despesas realizadas no mês", value: Number(caixa.despesasRealizadasMes), format: "currency" },
        ...(Number(caixa.aportesRegistrados) > 0
          ? [{ label: "Aportes registrados (informativo)", value: Number(caixa.aportesRegistrados), format: "currency" as const }]
          : []),
        { label: "Saídas previstas nos próximos 90 dias", value: Number(caixa.saidasPrevistas90Dias), format: "currency", tone: "forecast" },
      ],
    },
    {
      kind: "distribution",
      heading: "Origem do capital (despesas realizadas dos adquiridos)",
      items: data.origemCapital.map((o) => ({
        label: o.label,
        value: Number(o.total),
        percent: (Number(o.total) / (data.origemCapital.reduce((sum, x) => sum + Number(x.total), 0) || 1)) * 100,
        tone: o.key === "NAO_INFORMADO" ? ("cancelled" as const) : undefined,
      })),
    },
    {
      kind: "table",
      heading: "Imóveis adquiridos",
      sheet: "Adquiridos",
      columns: [
        { label: "Imóvel", weight: 3 },
        { label: "Etapa", weight: 1.8 },
        { label: "Dias em carteira", format: "integer", weight: 1 },
        { label: "Custo incorrido", format: "currency" },
        { label: "Avaliação Caixa", format: "currency" },
        { label: "Resultado projetado", format: "currency" },
        { label: "Margem", format: "percent", weight: 0.9 },
      ],
      rows: data.adquiridos.map((row) => [
        row.origem,
        row.etapa ? POST_ACQUISITION_STAGE_LABELS[row.etapa] : NO_STAGE_LABEL,
        row.diasEmCarteira,
        Number(row.custoIncorrido),
        row.semAvaliacao ? "Sem avaliação" : Number(row.avaliacao),
        row.resultadoProjetado === null ? "—" : { value: Number(row.resultadoProjetado), tone: Number(row.resultadoProjetado) < 0 ? ("negative" as const) : undefined },
        row.margemPercentual === null ? null : Number(row.margemPercentual),
      ]),
    },
  ];

  if (data.cancelados.length > 0) {
    sections.push({
      kind: "table",
      heading: "Aquisições canceladas (informativo)",
      sheet: "Cancelados",
      note: "Ficam fora do funil e da projeção; os lançamentos realizados continuam no caixa.",
      columns: [
        { label: "Imóvel", weight: 3 },
        { label: "Cancelada em", format: "date" },
        { label: "Capital investido", format: "currency" },
        { label: "Reembolsos", format: "currency" },
        { label: "Resultado realizado", format: "currency" },
      ],
      rows: data.cancelados.map((row) => [
        row.origem,
        row.canceladoEm ? new Date(row.canceladoEm) : null,
        Number(row.capitalInvestido),
        Number(row.reembolsos),
        { value: Number(row.resultadoRealizado), tone: Number(row.resultadoRealizado) < 0 ? ("negative" as const) : undefined },
      ]),
      footer: [
        "Total",
        null,
        data.cancelados.reduce((sum, row) => sum + Number(row.capitalInvestido), 0),
        data.cancelados.reduce((sum, row) => sum + Number(row.reembolsos), 0),
        Number(data.canceladosResultadoRealizado),
      ],
    });
  }

  if (data.alertas.length > 0) {
    sections.push({
      kind: "table",
      heading: "Pendências e alertas",
      columns: [{ label: "Pendência", weight: 5 }, { label: "Quantidade", format: "integer", weight: 1 }],
      rows: data.alertas.map((alert) => [
        { value: alert.message, tone: alert.tone === "negative" ? ("negative" as const) : alert.tone === "forecast" ? ("forecast" as const) : undefined },
        alert.count,
      ]),
    });
  }

  sections.push({
    kind: "table",
    heading: "Todos os imóveis",
    sheet: "Imóveis",
    columns: [
      { label: "Origem", weight: 3 },
      { label: "Cidade/UF", weight: 1.6 },
      { label: "Status", weight: 1.6 },
      { label: "Prioridade", weight: 1.1 },
      { label: "Avaliação", format: "currency" },
    ],
    rows: properties.map((p) => [
      p.origem,
      `${p.cidade}/${p.estado}`,
      PROSPECT_STATUS_LABELS[p.status],
      PRIORITY_LABELS[p.prioridade],
      Number(p.valorAvaliacao.toString()),
    ]),
  });

  return {
    typeLabel: "Resumo do portfólio",
    title: "Portfólio de imóveis",
    subtitle: `${monthName(data.month)} · ${counts.cadastrados} imóvel(is) cadastrado(s) · capital investido ${formatBRL(Number(carteira.capitalInvestido))}`,
    generatedAt: ctx.generatedAt,
    generatedBy: ctx.generatedBy,
    sections,
  };
}
