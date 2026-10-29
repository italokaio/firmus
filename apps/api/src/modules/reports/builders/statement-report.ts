import { Prisma } from "@prisma/client";
import { EMPRESA_ORIGEM_LABEL, ORIGEM_NAO_INFORMADA_LABEL, TRANSACTION_STATUS_LABELS } from "@leilao-erp/types";
import { sumByOrigin } from "../../finance/transaction-rules";
import type { ReportContent, ReportSection } from "../report-content.types";
import type { ReportContext } from "./context";
import { periodBounds, periodText } from "./helpers";
import { transactionsTable } from "./transactions-table";

export interface StatementReportInput {
  propertyId?: string;
  accountId?: string;
  categoryId?: string;
  status?: "PREVISTO" | "REALIZADO" | "CANCELADO";
  /** "EMPRESA", "NAO_INFORMADO" ou o id de um investidor. */
  origem?: string;
  from?: string;
  to?: string;
}

const ZERO = new Prisma.Decimal(0);

async function describeFilters(ctx: ReportContext, input: StatementReportInput): Promise<string[]> {
  const { prisma, companyId } = ctx;
  const [property, account, category, investor] = await Promise.all([
    input.propertyId ? prisma.property.findFirst({ where: { id: input.propertyId, companyId }, select: { origem: true } }) : null,
    input.accountId ? prisma.financeAccount.findFirst({ where: { id: input.accountId, companyId }, select: { name: true } }) : null,
    input.categoryId ? prisma.financeCategory.findFirst({ where: { id: input.categoryId, companyId }, select: { name: true } }) : null,
    input.origem && input.origem !== "EMPRESA" && input.origem !== "NAO_INFORMADO"
      ? prisma.investor.findFirst({ where: { id: input.origem, companyId }, select: { name: true } })
      : null,
  ]);
  const origemText =
    input.origem === "EMPRESA"
      ? EMPRESA_ORIGEM_LABEL
      : input.origem === "NAO_INFORMADO"
        ? ORIGEM_NAO_INFORMADA_LABEL
        : (investor?.name ?? null);

  return [
    property ? `Imóvel: ${property.origem}` : null,
    account ? `Conta: ${account.name}` : null,
    periodText(input.from, input.to) ? `Período: ${periodText(input.from, input.to)}` : null,
    category ? `Categoria: ${category.name.trim()}` : null,
    input.status ? `Status: ${TRANSACTION_STATUS_LABELS[input.status]}` : null,
    origemText ? `Pago por: ${origemText}` : null,
  ].filter((part): part is string => part !== null);
}

/** Extrato de Lançamentos: a tabela do Excel da fase 1 no layout de marca, com totais por categoria e por origem no fim. */
export async function buildStatementReportContent(
  ctx: ReportContext,
  input: StatementReportInput,
): Promise<{ content: ReportContent; contexto: string }> {
  const bounds = periodBounds(input.from, input.to);
  const rows = await ctx.financeService.listTransactionsForExport(ctx.companyId, {
    propertyId: input.propertyId,
    accountId: input.accountId,
    categoryId: input.categoryId,
    status: input.status,
    origem: input.origem,
    from: bounds.from,
    to: bounds.to,
  });
  const filters = await describeFilters(ctx, input);

  // Cancelados ficam listados, mas só entram nos totais quando o filtro pede esse status.
  const counted = rows.filter((tx) => tx.status !== "CANCELADO" || input.status === "CANCELADO");

  const byCategory = new Map<string, { name: string; type: string; count: number; total: Prisma.Decimal }>();
  for (const tx of counted) {
    const entry = byCategory.get(tx.categoryId) ?? { name: tx.category.name.trim(), type: tx.category.type, count: 0, total: ZERO };
    entry.count += 1;
    entry.total = entry.total.plus(tx.amount);
    byCategory.set(tx.categoryId, entry);
  }
  const origins = sumByOrigin(
    counted
      .filter((tx) => tx.category.type === "DESPESA")
      .map((tx) => ({
        amount: tx.amount,
        origemTipo: tx.origemTipo,
        investidorId: tx.investidorId,
        investidorName: tx.investidor?.name ?? null,
      })),
  );

  const sections: ReportSection[] = [
    transactionsTable(rows, { heading: `Lançamentos (${rows.length})` }),
    {
      kind: "table",
      heading: "Totais por categoria",
      sheet: "Totais",
      columns: [
        { label: "Categoria", weight: 3 },
        { label: "Tipo", weight: 1 },
        { label: "Lançamentos", format: "integer", weight: 1 },
        { label: "Total", format: "currency" },
      ],
      rows: [...byCategory.values()]
        .sort((a, b) => Number(b.total) - Number(a.total))
        .map((c) => [c.name, c.type === "RECEITA" ? "Receita" : "Despesa", c.count, Number(c.total)]),
      footer: ["Total (receitas − despesas)", null, counted.length, counted.reduce((s, tx) => s + (tx.category.type === "RECEITA" ? 1 : -1) * Number(tx.amount), 0)],
    },
    {
      kind: "table",
      heading: "Despesas por origem (Pago por)",
      sheet: "Totais",
      columns: [
        { label: "Pago por", weight: 3 },
        { label: "Lançamentos", format: "integer", weight: 1 },
        { label: "Total", format: "currency" },
      ],
      rows: origins.map((o) => [o.label, o.count, Number(o.total)]),
      footer: ["Total", origins.reduce((s, o) => s + o.count, 0), origins.reduce((s, o) => s + Number(o.total), 0)],
    },
  ];

  return {
    contexto: filters.length > 0 ? filters.join(" · ") : "Todos os lançamentos",
    content: {
      typeLabel: "Extrato de Lançamentos",
      title: "Extrato de lançamentos",
      subtitle: filters.length > 0 ? filters.join(" · ") : "Todos os lançamentos",
      generatedAt: ctx.generatedAt,
      generatedBy: ctx.generatedBy,
      orientation: "landscape",
      sections,
    },
  };
}
