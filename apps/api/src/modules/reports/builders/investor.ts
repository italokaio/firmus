import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { POST_ACQUISITION_STAGE_LABELS, PROSPECT_STATUS_LABELS, type PropertyStatementDto } from "@leilao-erp/types";
import type { CellInput, ReportContent, ReportSection } from "../report-content.types";
import { formatDateBR } from "../report-format";
import type { ReportContext } from "./context";
import { periodBounds, periodText, statusLabel, statusTone } from "./helpers";

const ZERO = new Prisma.Decimal(0);
export const NO_SPLIT_RULE_TEXT = "Divisão de resultado não configurada";

export interface InvestorReportInput {
  investorId: string;
  from?: string;
  to?: string;
  propertyId?: string;
}

interface PropertyBucket {
  propertyId: string | null;
  origem: string;
  pago: Prisma.Decimal;
}

/** Resultado do imóvel que cabe ao investidor: projetado (adquirido) ou realizado (vendido/cancelado). */
function propertyResult(statement: PropertyStatementDto): { base: string; value: number } | null {
  if (statement.mode === "ADQUIRIDO" && statement.cards.resultadoProjetado !== null) {
    return { base: "Projetado", value: Number(statement.cards.resultadoProjetado) };
  }
  if (statement.mode === "VENDIDO" || statement.mode === "CANCELADO") {
    return { base: "Realizado", value: Number(statement.cards.resultadoRealizado) };
  }
  return null;
}

/**
 * Relatório para Investidor: quanto ele pagou ("Pago por" = ele), imóvel a imóvel, e o resultado de cada
 * imóvel. O "resultado atribuível" só é mostrado onde há participação cadastrada (regra do módulo
 * Investidores: resultado × percentual da participação, bruto, antes do IR); sem participação aparece
 * "Divisão de resultado não configurada" — nunca se divide o resultado por conta própria.
 */
export async function buildInvestorContent(
  ctx: ReportContext,
  input: InvestorReportInput,
): Promise<{ content: ReportContent; contexto: string }> {
  const investor = await ctx.prisma.investor.findFirst({
    where: { id: input.investorId, companyId: ctx.companyId },
    select: { id: true, name: true },
  });
  if (!investor) throw new BadRequestException("Investidor não encontrado nesta empresa");

  const bounds = periodBounds(input.from, input.to);
  const transactions = await ctx.prisma.transaction.findMany({
    where: {
      financeAccount: { companyId: ctx.companyId, propertyId: input.propertyId },
      origemTipo: "INVESTIDOR",
      investidorId: input.investorId,
      status: { not: "CANCELADO" },
      date: {
        gte: bounds.from ? new Date(bounds.from) : undefined,
        lte: bounds.to ? new Date(bounds.to) : undefined,
      },
    },
    include: {
      category: { select: { id: true, name: true, type: true } },
      financeAccount: { select: { name: true, propertyId: true, property: { select: { origem: true } } } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Total pago por imóvel (despesas realizadas por ele).
  const buckets = new Map<string, PropertyBucket>();
  let totalPago = ZERO;
  let previstoAPagar = ZERO;
  for (const tx of transactions) {
    if (tx.category.type !== "DESPESA") continue;
    const key = tx.financeAccount.propertyId ?? "__sem_imovel__";
    const bucket = buckets.get(key) ?? {
      propertyId: tx.financeAccount.propertyId,
      origem: tx.financeAccount.property?.origem ?? "Contas gerais (sem imóvel)",
      pago: ZERO,
    };
    if (tx.status === "REALIZADO") {
      bucket.pago = bucket.pago.plus(tx.amount);
      totalPago = totalPago.plus(tx.amount);
    } else {
      previstoAPagar = previstoAPagar.plus(tx.amount);
    }
    buckets.set(key, bucket);
  }

  const propertyRows: CellInput[][] = [];
  const distributionRows: CellInput[][] = [];
  let anyParticipation = false;
  let anyProperty = false;
  for (const bucket of [...buckets.values()].sort((a, b) => a.origem.localeCompare(b.origem, "pt-BR"))) {
    if (!bucket.propertyId) {
      propertyRows.push([bucket.origem, "—", Number(bucket.pago), null, "—", null, null, "—"]);
      continue;
    }
    anyProperty = true;
    const [statement, participation] = await Promise.all([
      ctx.statementService.getStatement(ctx.companyId, bucket.propertyId, "TODOS", ctx.generatedAt),
      ctx.prisma.propertyInvestor.findFirst({
        where: { propertyId: bucket.propertyId, investorId: input.investorId },
        include: { distributions: { orderBy: { createdAt: "asc" } } },
      }),
    ]);
    const custoTotal = Number(statement.cards.capitalInvestido);
    const result = propertyResult(statement);
    const percentual = participation ? Number(participation.percentual) : null;
    if (participation) anyParticipation = true;

    let atribuivel: CellInput;
    if (!participation) atribuivel = NO_SPLIT_RULE_TEXT;
    else if (result === null) atribuivel = "—";
    else atribuivel = { value: (result.value * Number(participation.percentual)) / 100, tone: result.value < 0 ? "negative" : undefined };

    propertyRows.push([
      bucket.origem,
      statement.header.etapa
        ? POST_ACQUISITION_STAGE_LABELS[statement.header.etapa]
        : PROSPECT_STATUS_LABELS[statement.header.status],
      Number(bucket.pago),
      custoTotal > 0 ? (Number(bucket.pago) / custoTotal) * 100 : null,
      result ? result.base : "—",
      result ? { value: result.value, tone: result.value < 0 ? ("negative" as const) : undefined } : null,
      percentual,
      atribuivel,
    ]);

    for (const d of participation?.distributions ?? []) {
      distributionRows.push([
        bucket.origem,
        Number(d.lucroBase),
        Number(d.percentualAplicado),
        Number(d.valorBruto),
        Number(d.valorIR),
        Number(d.valorLiquido),
        d.status === "PAGO" ? "Pago" : "Pendente",
        d.dataPagamento ?? null,
      ]);
    }
  }

  const realizedCount = transactions.filter((t) => t.status === "REALIZADO" && t.category.type === "DESPESA").length;
  const sections: ReportSection[] = [
    {
      kind: "cards",
      cards: [
        { label: "Total pago pelo investidor", value: Number(totalPago), format: "currency", highlight: true, subtitle: "Despesas realizadas com “Pago por” = ele" },
        { label: "Imóveis", value: buckets.size, format: "integer", subtitle: "Com pagamentos no período" },
        { label: "Lançamentos pagos", value: realizedCount, format: "integer" },
        ...(previstoAPagar.greaterThan(0)
          ? [{ label: "Previsto a pagar", value: Number(previstoAPagar), format: "currency" as const, tone: "forecast" as const }]
          : []),
      ],
    },
    {
      kind: "table",
      heading: "Participação por imóvel",
      sheet: "Resumo",
      note: "% do custo = valor pago pelo investidor ÷ custo incorrido total do imóvel (todos os pagadores).",
      columns: [
        { label: "Imóvel", weight: 3 },
        { label: "Etapa", weight: 1.7 },
        { label: "Pago pelo investidor", format: "currency", weight: 1.5 },
        { label: "% do custo", format: "percent", weight: 0.9 },
        { label: "Base", weight: 1.1 },
        { label: "Resultado do imóvel", format: "currency", weight: 1.5 },
        { label: "Participação", format: "percent", weight: 1 },
        { label: "Resultado atribuível (bruto)", format: "currency", weight: 2 },
      ],
      rows: propertyRows,
      footer: ["Total", null, Number(totalPago), null, null, null, null, null],
    },
  ];

  if (anyProperty && !anyParticipation) {
    sections.push({
      kind: "callout",
      tone: "info",
      title: NO_SPLIT_RULE_TEXT,
      text: "Este investidor não tem participação cadastrada nos imóveis acima. Cadastre o percentual na aba Investidores do imóvel para ver o resultado atribuível. Nenhuma divisão proporcional foi aplicada.",
    });
  }

  if (distributionRows.length > 0) {
    sections.push({
      kind: "table",
      heading: "Distribuições de lucro registradas",
      sheet: "Distribuições",
      columns: [
        { label: "Imóvel", weight: 3 },
        { label: "Lucro base", format: "currency" },
        { label: "Participação", format: "percent", weight: 1 },
        { label: "Valor bruto", format: "currency" },
        { label: "IR", format: "currency" },
        { label: "Valor líquido", format: "currency" },
        { label: "Status", weight: 1 },
        { label: "Pagamento", format: "date" },
      ],
      rows: distributionRows,
    });
  }

  sections.push({
    kind: "table",
    heading: "Lançamentos pagos pelo investidor",
    sheet: "Lançamentos",
    columns: [
      { label: "Data", format: "date", weight: 1.1 },
      { label: "Imóvel", weight: 2.6 },
      { label: "Categoria", weight: 1.8 },
      { label: "Descrição", weight: 3 },
      { label: "Status", weight: 1.1 },
      { label: "Valor", format: "currency", weight: 1.5 },
    ],
    rows: transactions.map((tx) => [
      tx.date,
      tx.financeAccount.property?.origem ?? "—",
      tx.category.name.trim(),
      tx.description ?? "",
      { value: statusLabel(tx.status), tone: statusTone(tx.status) },
      Number(tx.amount),
    ]),
  });

  const period = periodText(input.from, input.to);
  const propertyName = input.propertyId
    ? (await ctx.prisma.property.findFirst({ where: { id: input.propertyId, companyId: ctx.companyId }, select: { origem: true } }))?.origem
    : null;
  const contexto = [investor.name, period, propertyName].filter(Boolean).join(" · ");

  return {
    contexto,
    content: {
      typeLabel: "Relatório para Investidor",
      title: investor.name,
      subtitle: [period ? `Período: ${period}` : `Posição em ${formatDateBR(ctx.generatedAt)}`, propertyName ? `Imóvel: ${propertyName}` : null]
        .filter(Boolean)
        .join(" · "),
      generatedAt: ctx.generatedAt,
      generatedBy: ctx.generatedBy,
      orientation: "landscape",
      sections,
    },
  };
}
