import type { ExportTransactionRow } from "../../finance/transactions-export";
import { formatOrigem } from "../../finance/transaction-rules";
import { TRANSACTION_STATUS_LABELS } from "@leilao-erp/types";
import type { CellInput, ReportColumn, TableSection } from "../report-content.types";
import { statusTone } from "./helpers";

/** Colunas do extrato — iguais no Excel de lançamentos, no extrato em PDF e na aba "Lançamentos" da DRE. */
export const TRANSACTION_COLUMNS: ReportColumn[] = [
  { label: "Data", format: "date", weight: 1.1 },
  { label: "Imóvel", weight: 2.4 },
  { label: "Conta de caixa", weight: 1.8 },
  { label: "Tipo", weight: 0.9 },
  { label: "Categoria", weight: 1.8 },
  { label: "Descrição", weight: 3 },
  { label: "Pago por", weight: 1.6 },
  { label: "Status", weight: 1.1 },
  { label: "Conciliado", weight: 1, align: "center" },
  { label: "Valor", format: "currency", weight: 1.5 },
];

export function transactionRow(tx: ExportTransactionRow): CellInput[] {
  const cancelled = tx.status === "CANCELADO";
  return [
    tx.date,
    tx.financeAccount.property?.origem ?? "—",
    tx.financeAccount.name,
    tx.category.type === "RECEITA" ? "Receita" : "Despesa",
    tx.category.name.trim(),
    tx.description ?? "",
    formatOrigem(tx.origemTipo, tx.investidor?.name ?? null),
    { value: TRANSACTION_STATUS_LABELS[tx.status], tone: statusTone(tx.status) },
    tx.conciliado ? "Sim" : "Não",
    { value: Number(tx.amount), tone: cancelled ? "cancelled" : undefined },
  ];
}

/** Uma linha por lançamento (valor numérico, permite tabela dinâmica no Excel). */
export function transactionsTable(
  rows: ExportTransactionRow[],
  options: { heading?: string; sheet?: string; pdf?: boolean; excel?: boolean } = {},
): TableSection {
  return {
    kind: "table",
    heading: options.heading ?? "Lançamentos",
    sheet: options.sheet ?? "Lançamentos",
    pdf: options.pdf,
    excel: options.excel,
    columns: TRANSACTION_COLUMNS,
    rows: rows.map(transactionRow),
  };
}
