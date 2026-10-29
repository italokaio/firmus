import ExcelJS from "exceljs";
import { PRINT_THEME } from "@leilao-erp/types";
import {
  cellOf,
  type CellFormat,
  type CellInput,
  type ReportContent,
  type ReportSection,
  type TableSection,
  type Tone,
} from "./report-content.types";
import { formatDateBR } from "./report-format";

const T = PRINT_THEME;
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

const NUM_FMT: Record<CellFormat, string | undefined> = {
  text: undefined,
  currency: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  date: "dd/mm/yyyy",
  percent: "0.0%",
  number: "#,##0.00",
  integer: "0",
};
const WIDTH: Record<CellFormat, number> = { text: 30, currency: 17, date: 12, percent: 10, number: 14, integer: 11 };

function toneColor(tone: Tone | undefined): string | undefined {
  if (!tone) return undefined;
  return argb(tone === "muted" ? T.textMuted : T.semantic[tone].text);
}

/** Excel não tem gráficos neste relatório: gráficos de PDF não vão para a planilha. */
function includedInExcel(section: ReportSection): boolean {
  if (section.excel === false) return false;
  return section.kind !== "columns" && section.kind !== "waterfall";
}

/** Normaliza qualquer seção textual para uma tabela (cards, kv, distribuição, destaque). */
function asTable(section: ReportSection): TableSection | null {
  switch (section.kind) {
    case "table":
      return section;
    case "kv":
      return {
        kind: "table",
        heading: section.heading,
        columns: [{ label: "Campo" }, { label: "Valor", format: "text" }],
        // Cada linha tem um formato próprio: vai como célula, com o formato aplicado na gravação.
        rows: section.rows.map((row) => [row.label, { value: row.value, tone: row.tone }]),
        _rowFormats: section.rows.map((row) => row.format ?? "text"),
      } as TableSection & { _rowFormats: CellFormat[] };
    case "cards":
      return {
        kind: "table",
        heading: section.heading ?? "Indicadores",
        columns: [{ label: "Indicador" }, { label: "Valor" }, { label: "Detalhe" }],
        rows: section.cards.map((card) => [card.label, { value: card.value, tone: card.tone }, card.subtitle ?? null]),
        _rowFormats: section.cards.map((card) => card.format ?? "text"),
      } as TableSection & { _rowFormats: CellFormat[] };
    case "distribution":
      return {
        kind: "table",
        heading: section.heading,
        columns: [
          { label: "Item" },
          { label: "Valor", format: section.valueFormat ?? "currency" },
          { label: "%", format: "percent" },
        ],
        rows: section.items.map((item) => [item.label, { value: item.value, tone: item.tone }, item.percent]),
      };
    case "callout":
      return {
        kind: "table",
        heading: section.title,
        columns: [{ label: "Observação" }],
        rows: section.text ? [[section.text]] : [],
      };
    default:
      return null;
  }
}

type RowFormats = { _rowFormats?: CellFormat[] };

function excelValue(input: CellInput, format: CellFormat): { value: ExcelJS.CellValue; numFmt?: string } {
  const { value } = cellOf(input);
  if (value === null || value === undefined || value === "") return { value: null };
  if (value instanceof Date) return { value: new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())), numFmt: NUM_FMT.date };
  if (typeof value === "number") {
    if (format === "percent") return { value: value / 100, numFmt: NUM_FMT.percent };
    return { value, numFmt: NUM_FMT[format] };
  }
  return { value };
}

export async function renderReportExcel(content: ReportContent): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FGI · Firmus Gestão Imobiliária";
  workbook.created = content.generatedAt;

  // Agrupa seções por aba, na ordem em que aparecem.
  const bySheet = new Map<string, ReportSection[]>();
  for (const section of content.sections) {
    if (!includedInExcel(section)) continue;
    const name = (section.sheet ?? "Resumo").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Resumo";
    bySheet.set(name, [...(bySheet.get(name) ?? []), section]);
  }
  if (bySheet.size === 0) bySheet.set("Resumo", []);

  for (const [name, sections] of bySheet) {
    const sheet = workbook.addWorksheet(name);
    const flat = sections.length === 1 && sections[0]!.kind === "table";
    const widths: number[] = [];
    const bumpWidth = (col: number, width: number) => {
      widths[col] = Math.max(widths[col] ?? 8, width);
    };
    let row = 1;

    if (!flat) {
      sheet.getCell(row, 1).value = content.title;
      sheet.getCell(row, 1).font = { bold: true, size: 14, color: { argb: argb(T.brand.petrol) } };
      row += 1;
      sheet.getCell(row, 1).value = content.subtitle;
      sheet.getCell(row, 1).font = { color: { argb: argb(T.textMuted) } };
      row += 1;
      sheet.getCell(row, 1).value = `Gerado em ${formatDateBR(content.generatedAt)} por ${content.generatedBy}`;
      sheet.getCell(row, 1).font = { color: { argb: argb(T.textMuted) } };
      row += 2;
    }

    for (const section of sections) {
      const table = asTable(section);
      if (!table) continue;
      const rowFormats = (table as TableSection & RowFormats)._rowFormats;
      const columnCount = table.columns.length;

      if (!flat) {
        sheet.getCell(row, 1).value = table.heading;
        sheet.getCell(row, 1).font = { bold: true, size: 12, color: { argb: argb(T.brand.petrol) } };
        row += 1;
      }

      const headerRow = sheet.getRow(row);
      table.columns.forEach((column, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = column.label;
        cell.font = { bold: true, color: { argb: argb(T.table.headerText) } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(T.table.headerBackground) } };
        cell.alignment = { vertical: "middle", horizontal: column.format && column.format !== "text" && column.format !== "date" ? "right" : "left", wrapText: true };
        bumpWidth(i + 1, Math.max(WIDTH[column.format ?? "text"], column.label.length + 2));
      });
      const headerRowNumber = row;
      row += 1;

      const writeRow = (cells: CellInput[], bold: boolean, isFooter = false, formatsOverride?: CellFormat) => {
        const excelRow = sheet.getRow(row);
        cells.forEach((input, i) => {
          const column = table.columns[i];
          const { tone, bold: cellBold } = cellOf(input);
          const format = formatsOverride && i === 1 ? formatsOverride : (column?.format ?? "text");
          const { value, numFmt } = excelValue(input, format);
          const cell = excelRow.getCell(i + 1);
          cell.value = value;
          if (numFmt) cell.numFmt = numFmt;
          cell.font = { bold: bold || cellBold, color: toneColor(tone) ? { argb: toneColor(tone)! } : undefined };
          cell.border = {
            bottom: { style: "thin", color: { argb: argb(T.border) } },
            ...(isFooter ? { top: { style: "medium", color: { argb: argb(T.brand.petrol) } } } : {}),
          };
          if (typeof value === "string") bumpWidth(i + 1, Math.min(60, value.length + 2));
          else if (typeof value === "number") bumpWidth(i + 1, 16);
        });
        row += 1;
      };

      const highlight = new Set(table.highlightRows ?? []);
      table.rows.forEach((cells, index) => writeRow(cells, highlight.has(index), false, rowFormats?.[index]));
      if (table.footer) writeRow(table.footer, true, true);

      if (flat) {
        sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
        sheet.autoFilter = {
          from: { row: headerRowNumber, column: 1 },
          to: { row: headerRowNumber, column: columnCount },
        };
      } else {
        row += 1;
      }
    }

    widths.forEach((width, col) => {
      if (col > 0) sheet.getColumn(col).width = Math.min(width, 60);
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
