/** Estrutura intermediária e neutra em formato — os dois renderizadores
 * (PDF/Excel) leem o mesmo `ReportContent`, então cada tipo de relatório só
 * precisa descrever seus dados uma vez, independente do formato pedido. */
export interface ReportSectionKV {
  kind: "kv";
  heading: string;
  rows: [string, string][];
}

export interface ReportSectionTable {
  kind: "table";
  heading: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

export type ReportSection = ReportSectionKV | ReportSectionTable;

export interface ReportContent {
  title: string;
  subtitle: string;
  sections: ReportSection[];
}
