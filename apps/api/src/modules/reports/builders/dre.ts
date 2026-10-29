import { NotFoundException } from "@nestjs/common";
import {
  POST_ACQUISITION_STAGE_LABELS,
  type PropertyStatementDto,
  type StatementGroupDto,
} from "@leilao-erp/types";
import { formatOrigem } from "../../finance/transaction-rules";
import type { CellInput, ReportContent, ReportSection, TableSection } from "../report-content.types";
import { formatBRL, formatDateBR, formatPercentBR } from "../report-format";
import type { ReportContext } from "./context";
import { monthLabel, statusLabel, statusTone } from "./helpers";
import { statementCards } from "./statement-cards";
import { transactionsTable } from "./transactions-table";

/** Despesas ou receitas agrupadas por categoria: linha de grupo com subtotal e %, depois cada lançamento. */
function groupedTable(heading: string, groups: StatementGroupDto[], sheet: string): TableSection {
  const rows: CellInput[][] = [];
  const highlightRows: number[] = [];

  for (const group of groups) {
    highlightRows.push(rows.length);
    rows.push([
      `${group.categoryName.trim()} (${group.count})`,
      group.reforma
        ? `Orçado ${formatBRL(Number(group.reforma.orcado))} · realizado ${formatBRL(Number(group.reforma.realizado))} · desvio ${
            group.reforma.desvioPercent === null ? "—" : formatPercentBR(Number(group.reforma.desvioPercent))
          }`
        : `${formatPercentBR(Number(group.percent))} do total`,
      "",
      "",
      Number(group.subtotal),
    ]);
    for (const tx of group.lancamentos) {
      const cancelled = tx.status === "CANCELADO";
      rows.push([
        new Date(tx.date),
        tx.description ?? "—",
        formatOrigem(tx.origemTipo, tx.investidor?.name ?? null),
        { value: statusLabel(tx.status), tone: statusTone(tx.status) },
        { value: Number(tx.amount), tone: cancelled ? "cancelled" : undefined },
      ]);
    }
  }

  return {
    kind: "table",
    heading,
    sheet,
    excel: false, // no Excel, os lançamentos vão na aba "Lançamentos" (uma linha por lançamento)
    columns: [
      { label: "Data / Categoria", weight: 2.4, align: "left" },
      { label: "Descrição", weight: 3 },
      { label: "Pago por", weight: 1.7 },
      { label: "Status", weight: 1.1 },
      { label: "Valor", format: "currency", weight: 1.5 },
    ],
    rows,
    highlightRows,
  };
}

function projectionSections(statement: PropertyStatementDto): ReportSection[] {
  const projection = statement.projecaoVenda;
  if (!projection) return [];
  const aval = Number(projection.avaliacao);
  const custo = Number(projection.custoIncorrido);
  const previsto = Number(projection.custosAteVenda);
  const resultado = Number(projection.resultadoProjetado);
  return [
    {
      kind: "waterfall",
      heading: "Projeção de venda",
      steps: [
        { label: "Avaliação Caixa", value: aval },
        { label: "Custo incorrido", value: -custo, tone: "realized" },
        { label: "Custos até a venda", value: -previsto, tone: "forecast" },
        { label: "Resultado projetado", value: resultado, total: true },
      ],
    },
    {
      kind: "kv",
      heading: "Projeção de venda",
      pdf: false,
      rows: [
        { label: "Avaliação Caixa", value: aval, format: "currency" },
        { label: "(−) Custo incorrido (despesas realizadas)", value: -custo, format: "currency" },
        { label: "(−) Custos até a venda (despesas previstas)", value: -previsto, format: "currency" },
        { label: "= Resultado projetado", value: resultado, format: "currency" },
        { label: "Margem (resultado ÷ avaliação)", value: projection.margemPercentual === null ? null : Number(projection.margemPercentual), format: "percent" },
        { label: "ROI (resultado ÷ custo + previstos)", value: projection.roiPercentual === null ? null : Number(projection.roiPercentual), format: "percent" },
      ],
    },
  ];
}

/** DRE do imóvel — espelha a aba Financeiro: cards, composição, capital acumulado, origem, lançamentos por categoria, fluxo e projeção. */
export async function buildDreContent(ctx: ReportContext, propertyId: string): Promise<ReportContent> {
  const property = await ctx.prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { origem: true, endereco: true, cidade: true, estado: true },
  });
  if (!property) throw new NotFoundException("Imóvel não encontrado");

  const [statement, transactionRows] = await Promise.all([
    ctx.statementService.getStatement(ctx.companyId, propertyId, "TODOS", ctx.generatedAt),
    ctx.financeService.listTransactionsForExport(ctx.companyId, { propertyId }),
  ]);
  const { header, cards } = statement;

  const sections: ReportSection[] = [];

  if (statement.mode === "CANCELADO") {
    sections.push({
      kind: "callout",
      tone: "negative",
      title: `Aquisição cancelada${header.canceladoEm ? ` em ${formatDateBR(new Date(header.canceladoEm))}` : ""}`,
      text: [
        header.motivoCancelamento ? `Motivo: ${header.motivoCancelamento}.` : null,
        `Resultado realizado (perda): ${formatBRL(Number(cards.resultadoRealizado))}.`,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  sections.push(statementCards(statement));

  sections.push({
    kind: "distribution",
    heading: "Composição do custo",
    items: statement.composicao.map((line) => ({
      label: line.categoryName.trim(),
      value: Number(line.total),
      percent: Number(line.percent),
    })),
  });

  if (statement.capitalAcumulado.length > 0) {
    sections.push({
      kind: "columns",
      heading: "Capital investido acumulado",
      categories: statement.capitalAcumulado.map((p) => monthLabel(p.month)),
      bars: { label: "No mês", values: statement.capitalAcumulado.map((p) => Number(p.valorMes)) },
      line: { label: "Acumulado", values: statement.capitalAcumulado.map((p) => Number(p.acumulado)) },
    });
    sections.push({
      kind: "table",
      heading: "Capital investido acumulado",
      pdf: false,
      columns: [{ label: "Mês" }, { label: "No mês", format: "currency" }, { label: "Acumulado", format: "currency" }],
      rows: statement.capitalAcumulado.map((p) => [monthLabel(p.month), Number(p.valorMes), Number(p.acumulado)]),
    });
  }

  sections.push({
    kind: "distribution",
    heading: "Origem do capital neste imóvel",
    items: statement.origemCapital.map((o) => ({
      label: o.label,
      value: Number(o.total),
      percent: Number(o.percent),
      tone: o.key === "NAO_INFORMADO" ? "cancelled" : undefined,
    })),
  });

  sections.push(groupedTable("Despesas por categoria", statement.despesas, "Lançamentos"));
  if (statement.receitas.length > 0) sections.push(groupedTable("Receitas por categoria", statement.receitas, "Lançamentos"));

  // Excel: abas Resumo, Lançamentos (uma linha por lançamento, como no extrato; todos os status) e Fluxo mensal.
  sections.push(transactionsTable(transactionRows, { pdf: false }));

  if (statement.fluxoMensal.length > 0) {
    sections.push({
      kind: "table",
      heading: "Fluxo mensal (previsto x realizado)",
      sheet: "Fluxo mensal",
      note: "Meses futuros com valores previstos aparecem em âmbar.",
      columns: [
        { label: "Mês", weight: 1 },
        { label: "Entradas previstas", format: "currency" },
        { label: "Saídas previstas", format: "currency" },
        { label: "Entradas realizadas", format: "currency" },
        { label: "Saídas realizadas", format: "currency" },
        { label: "Acumulado realizado", format: "currency" },
      ],
      rows: statement.fluxoMensal.map((m) => {
        const tone = m.futuro ? ("forecast" as const) : undefined;
        return [
          { value: monthLabel(m.month), tone },
          { value: Number(m.previstoEntradas), tone },
          { value: Number(m.previstoSaidas), tone },
          { value: Number(m.realizadoEntradas), tone },
          { value: Number(m.realizadoSaidas), tone },
          { value: Number(m.saldoAcumulado), tone },
        ];
      }),
    });
  }

  sections.push(...projectionSections(statement));

  return {
    typeLabel: "DRE do imóvel",
    title: property.origem,
    subtitle: [
      `${property.endereco} · ${property.cidade}/${property.estado}`,
      header.etapa ? POST_ACQUISITION_STAGE_LABELS[header.etapa] : null,
      header.dataAquisicao ? `Adquirido em ${formatDateBR(new Date(header.dataAquisicao))}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    generatedAt: ctx.generatedAt,
    generatedBy: ctx.generatedBy,
    sections,
  };
}
