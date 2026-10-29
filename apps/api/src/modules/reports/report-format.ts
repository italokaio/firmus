import { cellOf, type CellFormat, type CellInput } from "./report-content.types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const dateUtc = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

/** R$ 1.234,56 — negativos como −R$ 1.234,56 (sinal de menos tipográfico). */
export function formatBRL(value: number): string {
  const text = currency.format(Math.abs(value));
  return value < 0 && Math.abs(value) >= 0.005 ? `−${text}` : text;
}

/** Datas de lançamento são gravadas à meia-noite UTC — formata em UTC para não "voltar um dia". */
export function formatDateBR(value: Date): string {
  return dateUtc.format(value);
}

export function formatPercentBR(value: number): string {
  return `${percent1.format(value)}%`;
}

export function formatCompactBRL(value: number): string {
  return `R$ ${compact.format(value)}`;
}

/** Texto do valor para o PDF, conforme o formato da coluna/campo. */
export function formatForPdf(input: CellInput, format: CellFormat = "text"): string {
  const { value } = cellOf(input);
  // Nulo = sem dado ("—"); texto vazio = célula intencionalmente em branco (ex.: linha de subtotal).
  if (value === null || value === undefined) return "—";
  if (value === "") return "";
  if (value instanceof Date) return formatDateBR(value);
  if (typeof value === "number") {
    switch (format) {
      case "currency":
        return formatBRL(value);
      case "percent":
        return formatPercentBR(value);
      case "integer":
        return integer.format(value);
      case "number":
        return decimal.format(value);
      default:
        return String(value);
    }
  }
  return value;
}

/** Converte string decimal da API ("1234.50") em número para os relatórios. */
export function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}
