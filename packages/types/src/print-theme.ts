/**
 * Tema de impressão (PDF) da marca Firmus — mesmas cores do tema claro do app
 * (apps/web/app/globals.css). Os PDFs usam fundo levemente tingido, nunca branco puro.
 */
export const PRINT_THEME = {
  brand: {
    petrol: "#005666",
    cyan: "#0097B2",
    /** Ciano claro: legenda do tipo de relatório sobre a faixa petróleo. #4FC6DC dá só 4,14:1 aí; este dá 4,58:1. */
    cyanLight: "#62CFE3",
    white: "#FFFFFF",
  },
  page: { background: "#F1F7F8" },
  surface: "#FFFFFF",
  surface2: "#E2F1F4",
  border: "#D5E5E8",
  text: "#0B2F36",
  textMuted: "#4A6B72",
  /** Cabeçalho de tabela: texto branco sobre petróleo; linhas alternadas em `surface2`. */
  table: { headerBackground: "#005666", headerText: "#FFFFFF", stripe: "#E2F1F4" },
  /** Previsto = âmbar, realizado = petróleo, negativo = vermelho, cancelado = atenuado. */
  semantic: {
    forecast: { fill: "#C98A1C", text: "#926100" },
    realized: { fill: "#005666", text: "#005666" },
    negative: { fill: "#C0392B", text: "#C0392B" },
    cancelled: { fill: "#7FA4AB", text: "#4F6E74" },
  },
  /** Paleta de gráficos, nesta ordem. */
  chart: ["#0097B2", "#4FC6DC", "#C98A1C", "#4A6B72", "#005666"],
  fonts: { regular: "Poppins", medium: "Poppins-Medium", semibold: "Poppins-SemiBold", bold: "Poppins-Bold" },
  /** Corpo do texto nunca abaixo disso. */
  minFontSizePt: 9,
} as const;

/** Pares texto/fundo do tema de impressão que precisam passar de 4,5:1. */
export const PRINT_TEXT_PAIRS: ReadonlyArray<{ name: string; foreground: string; background: string }> = [
  { name: "texto sobre fundo da página", foreground: PRINT_THEME.text, background: PRINT_THEME.page.background },
  { name: "texto sobre card", foreground: PRINT_THEME.text, background: PRINT_THEME.surface },
  { name: "texto sobre linha alternada", foreground: PRINT_THEME.text, background: PRINT_THEME.table.stripe },
  { name: "texto atenuado sobre card", foreground: PRINT_THEME.textMuted, background: PRINT_THEME.surface },
  { name: "texto atenuado sobre fundo da página", foreground: PRINT_THEME.textMuted, background: PRINT_THEME.page.background },
  { name: "texto atenuado sobre linha alternada", foreground: PRINT_THEME.textMuted, background: PRINT_THEME.table.stripe },
  { name: "cabeçalho de tabela", foreground: PRINT_THEME.table.headerText, background: PRINT_THEME.table.headerBackground },
  { name: "título sobre a faixa petróleo", foreground: PRINT_THEME.brand.white, background: PRINT_THEME.brand.petrol },
  { name: "tipo do relatório (ciano claro) sobre a faixa petróleo", foreground: PRINT_THEME.brand.cyanLight, background: PRINT_THEME.brand.petrol },
  { name: "previsto (texto) sobre card", foreground: PRINT_THEME.semantic.forecast.text, background: PRINT_THEME.surface },
  { name: "realizado (texto) sobre card", foreground: PRINT_THEME.semantic.realized.text, background: PRINT_THEME.surface },
  { name: "negativo (texto) sobre card", foreground: PRINT_THEME.semantic.negative.text, background: PRINT_THEME.surface },
  { name: "cancelado (texto) sobre card", foreground: PRINT_THEME.semantic.cancelled.text, background: PRINT_THEME.surface },
  ...(["forecast", "realized", "negative", "cancelled"] as const).flatMap((key) => [
    { name: `${key} (texto) sobre fundo da página`, foreground: PRINT_THEME.semantic[key].text, background: PRINT_THEME.page.background },
    { name: `${key} (texto) sobre linha alternada`, foreground: PRINT_THEME.semantic[key].text, background: PRINT_THEME.table.stripe },
  ]),
];

/** Razão de contraste WCAG entre duas cores `#RRGGBB`. */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}
