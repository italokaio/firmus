import PDFDocument from "pdfkit";
import { PRINT_THEME } from "@leilao-erp/types";
import { PRINT_LOGOS, registerPrintFonts } from "./print-theme";
import {
  cellOf,
  type CalloutSection,
  type CardsSection,
  type CellFormat,
  type ColumnChartSection,
  type DistributionSection,
  type KeyValueSection,
  type ReportContent,
  type ReportSection,
  type TableSection,
  type Tone,
  type WaterfallSection,
} from "./report-content.types";
import { formatBRL, formatCompactBRL, formatDateBR, formatForPdf, formatPercentBR } from "./report-format";

type Doc = InstanceType<typeof PDFDocument>;

const T = PRINT_THEME;
const F = T.fonts;
const BODY = T.minFontSizePt; // corpo nunca abaixo de 9 pt
const MARGIN_X = 40;
const FOOTER_H = 36;
const GAP = 12;

const DEFAULT_WEIGHT: Record<CellFormat, number> = {
  text: 3,
  date: 1.1,
  currency: 1.5,
  percent: 1,
  number: 1.1,
  integer: 0.8,
};

function toneText(tone: Tone | undefined, fallback: string = T.text): string {
  if (!tone) return fallback;
  if (tone === "muted") return T.textMuted;
  return T.semantic[tone].text;
}
function toneFill(tone: Tone | undefined, fallback: string = T.brand.cyan): string {
  if (!tone) return fallback;
  if (tone === "muted") return T.textMuted;
  return T.semantic[tone].fill;
}

/**
 * Renderiza o relatório em PDF A4 no layout de marca: faixa petróleo com logo na 1ª página,
 * cabeçalho compacto nas seguintes, fundo tingido, cards, tabelas com cabeçalho repetido,
 * gráficos vetoriais e rodapé "Página X de Y". Todo o layout é manual (margens do pdfkit zeradas).
 */
export async function renderReportPdf(content: ReportContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: content.orientation ?? "portrait",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      info: { Title: content.title, Author: "FGI · Firmus Gestão Imobiliária", Subject: content.typeLabel },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      new PdfBuilder(doc, content).build();
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

class PdfBuilder {
  private y = 0;
  private pageCount = 0;
  private readonly w: number;
  private readonly h: number;
  private readonly contentW: number;
  private readonly limit: number;

  constructor(
    private readonly doc: Doc,
    private readonly content: ReportContent,
  ) {
    this.w = doc.page.width;
    this.h = doc.page.height;
    this.contentW = this.w - MARGIN_X * 2;
    this.limit = this.h - FOOTER_H - 8;
    registerPrintFonts(doc);
    // A 1ª página já existe: pinta manualmente; as demais, a cada `addPage`.
    this.paintPage();
    doc.on("pageAdded", () => this.paintPage());
  }

  build(): void {
    for (const section of this.content.sections) {
      if (section.pdf === false) continue;
      this.drawSection(section);
    }
    this.drawFooters();
  }

  // ---------- página ----------

  private paintPage(): void {
    const { doc } = this;
    this.pageCount += 1;
    doc.rect(0, 0, this.w, this.h).fill(T.page.background);
    this.y = this.pageCount === 1 ? this.drawFirstHeader() : this.drawCompactHeader();
  }

  private drawFirstHeader(): number {
    const { doc, content } = this;
    const logoH = 32;
    const titleW = this.contentW;

    doc.font(F.bold).fontSize(20);
    const titleH = doc.heightOfString(content.title, { width: titleW });
    doc.font(F.regular).fontSize(BODY);
    const subtitleH = doc.heightOfString(content.subtitle, { width: titleW });

    const bandH = 20 + logoH + 16 + 12 + 4 + titleH + 4 + subtitleH + 18;
    doc.rect(0, 0, this.w, bandH).fill(T.brand.petrol);
    doc.image(PRINT_LOGOS.white, MARGIN_X, 20, { height: logoH });

    doc
      .font(F.regular)
      .fontSize(BODY)
      .fillColor(T.brand.white)
      .text(`Gerado em ${formatDateBR(content.generatedAt)} por ${content.generatedBy}`, MARGIN_X, 26, {
        width: titleW,
        align: "right",
        lineBreak: false,
      });

    let y = 20 + logoH + 16;
    doc
      .font(F.semibold)
      .fontSize(BODY)
      .fillColor(T.brand.cyanLight)
      .text(content.typeLabel.toUpperCase(), MARGIN_X, y, { width: titleW, characterSpacing: 1.2 });
    y += 12 + 4;
    doc.font(F.bold).fontSize(20).fillColor(T.brand.white).text(content.title, MARGIN_X, y, { width: titleW });
    y += titleH + 4;
    doc.font(F.regular).fontSize(BODY).fillColor(T.brand.white).text(content.subtitle, MARGIN_X, y, { width: titleW });
    return bandH + 18;
  }

  private drawCompactHeader(): number {
    const { doc } = this;
    const bandH = 38;
    doc.rect(0, 0, this.w, bandH).fill(T.brand.petrol);
    doc.image(PRINT_LOGOS.white, MARGIN_X, 11, { height: 16 });
    doc
      .font(F.medium)
      .fontSize(BODY)
      .fillColor(T.brand.white)
      .text(this.content.title, MARGIN_X + 80, 14, {
        width: this.contentW - 80,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      });
    return bandH + 18;
  }

  private drawFooters(): void {
    const { doc } = this;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const lineY = this.h - FOOTER_H + 6;
      doc.moveTo(MARGIN_X, lineY).lineTo(this.w - MARGIN_X, lineY).lineWidth(0.5).strokeColor(T.border).stroke();
      doc
        .font(F.regular)
        .fontSize(BODY)
        .fillColor(T.textMuted)
        .text("FGI · Firmus Gestão Imobiliária", MARGIN_X, lineY + 8, { width: this.contentW / 2, lineBreak: false });
      doc.text(`Página ${i + 1} de ${range.count}`, MARGIN_X + this.contentW / 2, lineY + 8, {
        width: this.contentW / 2,
        align: "right",
        lineBreak: false,
      });
    }
  }

  /** Garante `height` pontos livres; senão abre nova página. Retorna true se abriu. */
  private ensureSpace(height: number): boolean {
    if (this.y + height <= this.limit) return false;
    this.doc.addPage();
    return true;
  }

  // ---------- seções ----------

  private drawSection(section: ReportSection): void {
    switch (section.kind) {
      case "cards":
        return this.drawCards(section);
      case "kv":
        return this.drawKeyValue(section);
      case "table":
        return this.drawTable(section);
      case "distribution":
        return this.drawDistribution(section);
      case "columns":
        return this.drawColumnChart(section);
      case "waterfall":
        return this.drawWaterfall(section);
      case "callout":
        return this.drawCallout(section);
    }
  }

  private drawHeading(text: string, keepWith = 60): void {
    this.ensureSpace(24 + keepWith);
    const { doc } = this;
    doc.rect(MARGIN_X, this.y + 1, 4, 15).fill(T.brand.cyan);
    doc.font(F.semibold).fontSize(12).fillColor(T.text).text(text, MARGIN_X + 12, this.y, {
      width: this.contentW - 12,
      lineBreak: false,
    });
    this.y += 24;
  }

  private textHeight(text: string, width: number, font: string, size: number): number {
    this.doc.font(font).fontSize(size);
    return this.doc.heightOfString(text, { width });
  }

  // ----- cards -----

  private drawCards(section: CardsSection): void {
    const { doc } = this;
    if (section.heading) this.drawHeading(section.heading, 70);
    // 4 cards em retrato ficam em grade 2x2 (valores grandes precisam de largura).
    const portraitPerRow = section.cards.length === 4 ? 2 : 3;
    const perRow = this.content.orientation === "landscape" ? 4 : portraitPerRow;
    const cardW = (this.contentW - GAP * (perRow - 1)) / perRow;
    const innerW = cardW - 20;

    for (let start = 0; start < section.cards.length; start += perRow) {
      const row = section.cards.slice(start, start + perRow);
      const measured = row.map((card) => {
        const label = this.textHeight(card.label, innerW, F.regular, BODY);
        const value = this.textHeight(formatForPdf(card.value, card.format ?? "text"), innerW, F.bold, 14);
        const sub = card.subtitle ? this.textHeight(card.subtitle, innerW, F.regular, BODY) : 0;
        return { label, value, sub };
      });
      const rowH = Math.max(...measured.map((m) => 10 + m.label + 3 + m.value + (m.sub ? 3 + m.sub : 0) + 10)) + 3;
      this.ensureSpace(rowH + GAP);

      row.forEach((card, index) => {
        const x = MARGIN_X + index * (cardW + GAP);
        const fill = card.highlight ? T.brand.petrol : T.surface;
        doc.roundedRect(x, this.y, cardW, rowH, 6).fill(fill);
        if (!card.highlight) doc.roundedRect(x, this.y, cardW, rowH, 6).lineWidth(0.5).stroke(T.border);
        doc.rect(x + 6, this.y, cardW - 12, 3).fill(card.highlight ? T.brand.cyan : toneFill(card.tone));

        const textColor = card.highlight ? T.brand.white : T.text;
        const mutedColor = card.highlight ? T.brand.white : T.textMuted;
        let ty = this.y + 13;
        doc.font(F.regular).fontSize(BODY).fillColor(mutedColor).text(card.label, x + 10, ty, { width: innerW });
        ty += measured[index]!.label + 3;
        doc
          .font(F.bold)
          .fontSize(14)
          .fillColor(card.highlight ? textColor : toneText(card.tone))
          .text(formatForPdf(card.value, card.format ?? "text"), x + 10, ty, { width: innerW });
        ty += measured[index]!.value + 3;
        if (card.subtitle) {
          doc.font(F.regular).fontSize(BODY).fillColor(mutedColor).text(card.subtitle, x + 10, ty, { width: innerW });
        }
      });
      this.y += rowH + GAP;
    }
    this.y += 4;
  }

  // ----- chave/valor -----

  private drawKeyValue(section: KeyValueSection): void {
    const { doc } = this;
    this.drawHeading(section.heading, 40);
    const labelW = this.contentW * 0.42;
    const valueW = this.contentW - labelW - 24;

    section.rows.forEach((row, index) => {
      const value = formatForPdf(row.value, row.format ?? "text");
      const rowH =
        Math.max(
          this.textHeight(row.label, labelW - 12, F.regular, BODY),
          this.textHeight(value, valueW, F.medium, BODY),
        ) + 12;
      this.ensureSpace(rowH);
      doc.rect(MARGIN_X, this.y, this.contentW, rowH).fill(index % 2 === 1 ? T.table.stripe : T.surface);
      doc.font(F.regular).fontSize(BODY).fillColor(T.textMuted).text(row.label, MARGIN_X + 12, this.y + 6, { width: labelW - 12 });
      doc
        .font(F.medium)
        .fontSize(BODY)
        .fillColor(toneText(row.tone))
        .text(value, MARGIN_X + labelW, this.y + 6, { width: valueW, align: "right" });
      this.y += rowH;
    });
    doc.moveTo(MARGIN_X, this.y).lineTo(this.w - MARGIN_X, this.y).lineWidth(0.5).strokeColor(T.border).stroke();
    this.y += 18;
  }

  // ----- tabela -----

  /**
   * Largura de cada coluna: primeiro o mínimo que o conteúdo exige (cabeçalho sem quebrar no meio da
   * palavra; datas, valores e números inteiros em uma linha só; palavras longas inteiras), depois a sobra
   * é repartida pelos pesos. Se nem os mínimos cabem, eles são reduzidos em proporção.
   */
  private columnWidths(section: TableSection): number[] {
    const { doc } = this;
    const pad = 12;
    const longestWord = (text: string, font: string) => {
      doc.font(font).fontSize(BODY);
      return Math.max(0, ...text.split(/\s+/).map((word) => doc.widthOfString(word)));
    };

    const minimums = section.columns.map((column, i) => {
      const format = column.format ?? "text";
      let min = longestWord(column.label, F.semibold);
      for (const row of section.rows.slice(0, 300)) {
        const text = formatForPdf(row[i] ?? null, format);
        doc.font(F.regular).fontSize(BODY);
        // Colunas de data/número ficam em uma linha só; as de texto não quebram palavra.
        const width = format === "text" ? Math.min(longestWord(text, F.regular), 110) : doc.widthOfString(text);
        min = Math.max(min, width);
      }
      // +4: folga contra o arredondamento do pdfkit (largura exata do texto = quebra de linha).
      return min + pad + 4;
    });

    const weights = section.columns.map((c) => c.weight ?? DEFAULT_WEIGHT[c.format ?? "text"]);
    const totalMin = minimums.reduce((a, b) => a + b, 0);
    if (totalMin >= this.contentW) return minimums.map((m) => (m / totalMin) * this.contentW);

    const spare = this.contentW - totalMin;
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return minimums.map((min, i) => min + (weights[i]! / totalWeight) * spare);
  }

  private alignOf(section: TableSection, index: number): "left" | "right" | "center" {
    const column = section.columns[index]!;
    if (column.align) return column.align;
    return column.format && column.format !== "text" && column.format !== "date" ? "right" : "left";
  }

  private drawTable(section: TableSection): void {
    const { doc } = this;
    const widths = this.columnWidths(section);
    const pad = 6;

    const headerHeight = () =>
      Math.max(
        ...section.columns.map((c, i) => this.textHeight(c.label, widths[i]! - pad * 2, F.semibold, BODY)),
      ) + 10;
    const drawHeader = () => {
      const hh = headerHeight();
      doc.rect(MARGIN_X, this.y, this.contentW, hh).fill(T.table.headerBackground);
      let x = MARGIN_X;
      section.columns.forEach((column, i) => {
        doc
          .font(F.semibold)
          .fontSize(BODY)
          .fillColor(T.table.headerText)
          .text(column.label, x + pad, this.y + 5, { width: widths[i]! - pad * 2, align: this.alignOf(section, i) });
        x += widths[i]!;
      });
      this.y += hh;
    };

    const rowHeight = (cells: ReturnType<typeof cellOf>[], bold: boolean) =>
      Math.max(
        ...cells.map((cell, i) =>
          this.textHeight(
            formatForPdf(cell, section.columns[i]?.format ?? "text"),
            widths[i]! - pad * 2,
            bold || cell.bold ? F.semibold : F.regular,
            BODY,
          ),
        ),
      ) + 10;

    const drawRow = (rawCells: typeof section.rows[number], index: number, opts: { footer?: boolean; group?: boolean }) => {
      const cells = rawCells.map(cellOf);
      const bold = Boolean(opts.footer || opts.group);
      const rh = rowHeight(cells, bold);
      if (this.ensureSpace(rh)) drawHeader();
      const fill = opts.group ? T.table.stripe : opts.footer ? T.surface : index % 2 === 1 ? T.table.stripe : T.surface;
      doc.rect(MARGIN_X, this.y, this.contentW, rh).fill(fill);
      if (opts.footer) doc.moveTo(MARGIN_X, this.y).lineTo(this.w - MARGIN_X, this.y).lineWidth(1).strokeColor(T.brand.petrol).stroke();
      let x = MARGIN_X;
      cells.forEach((cell, i) => {
        doc
          .font(bold || cell.bold ? F.semibold : F.regular)
          .fontSize(BODY)
          .fillColor(toneText(cell.tone))
          .text(formatForPdf(cell, section.columns[i]?.format ?? "text"), x + pad, this.y + 5, {
            width: widths[i]! - pad * 2,
            align: this.alignOf(section, i),
          });
        x += widths[i]!;
      });
      this.y += rh;
    };

    // Título + cabeçalho + 1ª linha ficam juntos.
    const firstRowH = section.rows[0] ? rowHeight(section.rows[0].map(cellOf), false) : 20;
    this.drawHeading(section.heading, headerHeight() + firstRowH);
    if (section.note) {
      const noteH = this.textHeight(section.note, this.contentW, F.regular, BODY);
      doc.font(F.regular).fontSize(BODY).fillColor(T.textMuted).text(section.note, MARGIN_X, this.y - 4, { width: this.contentW });
      this.y += noteH + 2;
    }

    if (section.rows.length === 0) {
      doc.font(F.regular).fontSize(BODY).fillColor(T.textMuted).text("Sem registros.", MARGIN_X, this.y);
      this.y += 28;
      return;
    }

    drawHeader();
    const highlight = new Set(section.highlightRows ?? []);
    section.rows.forEach((row, index) => drawRow(row, index, { group: highlight.has(index) }));
    if (section.footer) drawRow(section.footer, 0, { footer: true });
    doc.moveTo(MARGIN_X, this.y).lineTo(this.w - MARGIN_X, this.y).lineWidth(0.5).strokeColor(T.border).stroke();
    this.y += 20;
  }

  // ----- distribuição (barra 100% + legenda) -----

  private drawDistribution(section: DistributionSection): void {
    const { doc } = this;
    this.drawHeading(section.heading, 60);
    if (section.items.length === 0) {
      doc.font(F.regular).fontSize(BODY).fillColor(T.textMuted).text("Sem registros.", MARGIN_X, this.y);
      this.y += 28;
      return;
    }

    const total = section.items.reduce((sum, item) => sum + item.percent, 0) || 1;
    let x = MARGIN_X;
    section.items.forEach((item, index) => {
      const segW = (item.percent / total) * this.contentW;
      doc.rect(x, this.y, segW, 12).fill(toneFill(item.tone, T.chart[index % T.chart.length]));
      x += segW;
    });
    this.y += 12 + 12;

    section.items.forEach((item, index) => {
      this.ensureSpace(18);
      doc.circle(MARGIN_X + 5, this.y + 6, 4).fill(toneFill(item.tone, T.chart[index % T.chart.length]));
      doc.font(F.regular).fontSize(BODY).fillColor(T.text).text(item.label, MARGIN_X + 16, this.y, {
        width: this.contentW * 0.55,
        lineBreak: false,
        ellipsis: true,
      });
      doc
        .font(F.medium)
        .fontSize(BODY)
        .fillColor(T.text)
        .text(
          `${formatForPdf(item.value, section.valueFormat ?? "currency")}  (${formatPercentBR(item.percent)})`,
          MARGIN_X + this.contentW * 0.55,
          this.y,
          { width: this.contentW * 0.45, align: "right", lineBreak: false },
        );
      this.y += 18;
    });
    this.y += 10;
  }

  // ----- gráfico de colunas + linha -----

  private drawColumnChart(section: ColumnChartSection): void {
    const { doc } = this;
    const chartH = 150;
    const labelRow = 30;
    this.drawHeading(section.heading, chartH + labelRow + 24);
    if (section.categories.length === 0) return;

    const left = MARGIN_X + 52;
    const plotW = this.contentW - 52;
    const top = this.y + 6;
    const maxValue = Math.max(1, ...section.bars.values, ...(section.line?.values ?? [0])) * 1.1;

    // Linhas de grade e rótulos do eixo Y
    for (let i = 0; i <= 4; i += 1) {
      const gy = top + chartH - (chartH * i) / 4;
      doc.moveTo(left, gy).lineTo(left + plotW, gy).lineWidth(0.4).strokeColor(T.border).stroke();
      doc
        .font(F.regular)
        .fontSize(BODY)
        .fillColor(T.textMuted)
        .text(formatCompactBRL((maxValue * i) / 4), MARGIN_X, gy - 5, { width: 48, align: "right", lineBreak: false });
    }

    const slot = plotW / section.categories.length;
    const barW = Math.min(slot * 0.55, 46);
    const pointY = (value: number) => top + chartH - (value / maxValue) * chartH;

    section.categories.forEach((category, i) => {
      const cx = left + slot * i + slot / 2;
      const barTop = pointY(section.bars.values[i] ?? 0);
      doc.rect(cx - barW / 2, barTop, barW, top + chartH - barTop).fill(T.brand.cyan);
      doc
        .font(F.regular)
        .fontSize(BODY)
        .fillColor(T.textMuted)
        .text(category, cx - slot / 2, top + chartH + 6, { width: slot, align: "center", lineBreak: false });
    });

    if (section.line) {
      const pts = section.line.values.map((value, i) => ({ x: left + slot * i + slot / 2, y: pointY(value) }));
      doc.lineWidth(2).strokeColor(T.brand.petrol);
      pts.forEach((p, i) => (i === 0 ? doc.moveTo(p.x, p.y) : doc.lineTo(p.x, p.y)));
      doc.stroke();
      pts.forEach((p) => doc.circle(p.x, p.y, 3).fill(T.brand.petrol));
    }

    // Legenda
    const legendY = top + chartH + labelRow;
    doc.rect(left, legendY + 2, 10, 8).fill(T.brand.cyan);
    doc.font(F.regular).fontSize(BODY).fillColor(T.text).text(section.bars.label, left + 16, legendY, { lineBreak: false });
    if (section.line) {
      const lx = left + 20 + doc.widthOfString(section.bars.label) + 16;
      doc.rect(lx, legendY + 5, 12, 2).fill(T.brand.petrol);
      doc.font(F.regular).fontSize(BODY).fillColor(T.text).text(section.line.label, lx + 18, legendY, { lineBreak: false });
    }
    this.y = legendY + 26;
  }

  // ----- cascata -----

  private drawWaterfall(section: WaterfallSection): void {
    const { doc } = this;
    const chartH = 140;
    const labelRow = 40;
    this.drawHeading(section.heading, chartH + labelRow + 30);

    // Posição acumulada de cada barra (flutuante)
    let running = 0;
    const bars = section.steps.map((step) => {
      const start = step.total ? 0 : running;
      const end = step.total ? step.value : running + step.value;
      if (!step.total) running = end;
      return { step, lo: Math.min(start, end), hi: Math.max(start, end) };
    });
    const maxValue = Math.max(1, ...bars.map((b) => b.hi)) * 1.15;
    const minValue = Math.min(0, ...bars.map((b) => b.lo));
    const span = maxValue - minValue;
    const top = this.y + 18;
    const yOf = (value: number) => top + chartH - ((value - minValue) / span) * chartH;
    const slot = this.contentW / bars.length;
    const barW = Math.min(slot * 0.55, 70);

    doc.moveTo(MARGIN_X, yOf(0)).lineTo(MARGIN_X + this.contentW, yOf(0)).lineWidth(0.5).strokeColor(T.border).stroke();
    bars.forEach(({ step, lo, hi }, i) => {
      const cx = MARGIN_X + slot * i + slot / 2;
      const color = step.total
        ? step.value < 0
          ? T.semantic.negative.fill
          : T.brand.cyan
        : toneFill(step.tone, T.brand.cyan);
      const barTop = yOf(hi);
      const barH = Math.max(2, yOf(lo) - barTop);
      doc.rect(cx - barW / 2, barTop, barW, barH).fill(color);
      doc
        .font(F.semibold)
        .fontSize(BODY)
        .fillColor(step.value < 0 ? T.semantic.negative.text : T.text)
        .text(formatBRL(step.value), cx - slot / 2, barTop - 14, { width: slot, align: "center", lineBreak: false });
      doc
        .font(F.regular)
        .fontSize(BODY)
        .fillColor(T.textMuted)
        .text(step.label, cx - slot / 2 + 4, top + chartH + 8, { width: slot - 8, align: "center" });
    });
    this.y = top + chartH + labelRow + 10;
  }

  // ----- destaque -----

  private drawCallout(section: CalloutSection): void {
    const { doc } = this;
    const accent = section.tone === "negative" ? T.semantic.negative.fill : section.tone === "forecast" ? T.semantic.forecast.fill : T.brand.cyan;
    const textW = this.contentW - 28;
    const titleH = this.textHeight(section.title, textW, F.semibold, 10);
    const bodyH = section.text ? this.textHeight(section.text, textW, F.regular, BODY) : 0;
    const boxH = 12 + titleH + (bodyH ? 4 + bodyH : 0) + 12;
    this.ensureSpace(boxH + GAP);

    doc.roundedRect(MARGIN_X, this.y, this.contentW, boxH, 6).fill(T.surface);
    doc.roundedRect(MARGIN_X, this.y, this.contentW, boxH, 6).lineWidth(0.5).stroke(T.border);
    doc.rect(MARGIN_X, this.y + 4, 4, boxH - 8).fill(accent);
    doc.font(F.semibold).fontSize(10).fillColor(T.text).text(section.title, MARGIN_X + 16, this.y + 12, { width: textW });
    if (section.text) {
      doc.font(F.regular).fontSize(BODY).fillColor(T.textMuted).text(section.text, MARGIN_X + 16, this.y + 12 + titleH + 4, { width: textW });
    }
    this.y += boxH + GAP + 4;
  }
}
