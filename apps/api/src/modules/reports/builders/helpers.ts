import { TRANSACTION_STATUS_LABELS, type TransactionStatus } from "@leilao-erp/types";
import type { Tone } from "../report-content.types";
import { formatDateBR } from "../report-format";

export const statusTone = (status: TransactionStatus): Tone =>
  status === "PREVISTO" ? "forecast" : status === "REALIZADO" ? "realized" : "cancelled";

export const statusLabel = (status: TransactionStatus) => TRANSACTION_STATUS_LABELS[status];

/** "2026-10" → "10/2026". */
export function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  return `${mon}/${year}`;
}

/** "AAAA-MM" → "outubro de 2026". */
export function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Período "AAAA-MM-DD" → texto para o contexto do relatório. */
export function periodText(from?: string, to?: string): string | null {
  const fmt = (iso: string) => formatDateBR(new Date(`${iso}T00:00:00.000Z`));
  if (from && to) return `${fmt(from)} a ${fmt(to)}`;
  if (from) return `a partir de ${fmt(from)}`;
  if (to) return `até ${fmt(to)}`;
  return null;
}

/** Limites do período como datas UTC (o "até" é inclusivo: fim do dia). */
export function periodBounds(from?: string, to?: string): { from?: string; to?: string } {
  return {
    from: from ? `${from}T00:00:00.000Z` : undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
  };
}
