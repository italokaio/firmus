const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(Number(value));
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

/** Para datas de calendário gravadas à meia-noite UTC (ex.: data do lançamento) — evita mostrar um dia a menos no fuso do Brasil. */
export function formatCalendarDate(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Percentual vindo da API como string (ex.: "51.99" → "52,0%"). */
export function formatPercent(value: string | number): string {
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
