/**
 * Conteúdo de um relatório, neutro em formato: os renderizadores de PDF e de Excel leem o mesmo
 * `ReportContent`, então cada relatório descreve seus dados uma única vez. Os valores são TIPADOS
 * (número, data, texto) — o PDF os formata em pt-BR e o Excel os grava como números/datas de verdade
 * (permite tabela dinâmica).
 */

export type CellFormat = "text" | "currency" | "date" | "percent" | "number" | "integer";

/** Cor semântica do valor: previsto = âmbar, realizado = petróleo, negativo = vermelho, cancelado = atenuado. */
export type Tone = "forecast" | "realized" | "negative" | "cancelled" | "muted";

export type CellValue = string | number | Date | null;
export interface ReportCell {
  value: CellValue;
  tone?: Tone;
  bold?: boolean;
}
export type CellInput = CellValue | ReportCell;

export interface ReportColumn {
  label: string;
  format?: CellFormat;
  /** Peso relativo da largura no PDF (padrão por formato). */
  weight?: number;
  align?: "left" | "right" | "center";
}

/** Onde a seção aparece: por padrão nos dois formatos. Gráficos são só de PDF. */
interface SectionTargets {
  /** Nome da aba no Excel (padrão: "Resumo"). */
  sheet?: string;
  pdf?: boolean;
  excel?: boolean;
}

export interface CardsSection extends SectionTargets {
  kind: "cards";
  heading?: string;
  cards: Array<{
    label: string;
    value: CellValue;
    format?: CellFormat;
    subtitle?: string;
    /** Card sólido petróleo (o KPI principal). */
    highlight?: boolean;
    tone?: Tone;
  }>;
}

export interface KeyValueSection extends SectionTargets {
  kind: "kv";
  heading: string;
  rows: Array<{ label: string; value: CellValue; format?: CellFormat; tone?: Tone }>;
}

export interface TableSection extends SectionTargets {
  kind: "table";
  heading: string;
  note?: string;
  columns: ReportColumn[];
  rows: CellInput[][];
  /** Linha de totais (negrito, com filete). */
  footer?: CellInput[];
  /** Linhas que são cabeçalho de grupo (subtotal por categoria etc.) — destacadas. */
  highlightRows?: number[];
}

/** Barra 100% + legenda (composição do custo, origem do capital). Sai no Excel como tabela. */
export interface DistributionSection extends SectionTargets {
  kind: "distribution";
  heading: string;
  items: Array<{ label: string; value: number; percent: number; tone?: Tone }>;
  valueFormat?: CellFormat;
}

/** Barras (e uma linha opcional) por categoria — só PDF. */
export interface ColumnChartSection extends SectionTargets {
  kind: "columns";
  heading: string;
  categories: string[];
  bars: { label: string; values: number[] };
  line?: { label: string; values: number[] };
}

/** Cascata: cada passo é um valor com sinal; o último é o total. Só PDF. */
export interface WaterfallSection extends SectionTargets {
  kind: "waterfall";
  heading: string;
  steps: Array<{ label: string; value: number; tone?: Tone; total?: boolean }>;
}

export interface CalloutSection extends SectionTargets {
  kind: "callout";
  tone: "negative" | "forecast" | "info";
  title: string;
  text?: string;
}

export type ReportSection =
  | CardsSection
  | KeyValueSection
  | TableSection
  | DistributionSection
  | ColumnChartSection
  | WaterfallSection
  | CalloutSection;

export interface ReportContent {
  /** Tipo do relatório em caixa alta, exibido sobre o título (ex.: "DRE DO IMÓVEL"). */
  typeLabel: string;
  title: string;
  /** Contexto: imóvel/período/filtros. */
  subtitle: string;
  generatedAt: Date;
  generatedBy: string;
  orientation?: "portrait" | "landscape";
  sections: ReportSection[];
}

export function cellOf(input: CellInput): ReportCell {
  return input !== null && typeof input === "object" && !(input instanceof Date) ? input : { value: input };
}
