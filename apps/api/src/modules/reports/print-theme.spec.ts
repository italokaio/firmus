import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { PRINT_TEXT_PAIRS, PRINT_THEME, contrastRatio } from "@leilao-erp/types";
import { PRINT_FONT_FILES, PRINT_LOGOS, registerPrintFonts } from "./print-theme";

describe("tema de impressão", () => {
  it.each(PRINT_TEXT_PAIRS.map((p) => [p.name, p] as const))("contraste de %s ≥ 4,5:1", (_name, pair) => {
    expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("o fundo da página não é branco puro", () => {
    expect(PRINT_THEME.page.background.toUpperCase()).not.toBe("#FFFFFF");
  });

  it("fontes e logos existem no disco", () => {
    for (const file of [...Object.values(PRINT_FONT_FILES), ...Object.values(PRINT_LOGOS)]) {
      expect(existsSync(file)).toBe(true);
    }
  });

  it("gera um PDF com Poppins embutida e logo", async () => {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      registerPrintFonts(doc);
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(PRINT_THEME.page.background);
      doc.rect(0, 0, doc.page.width, 90).fill(PRINT_THEME.brand.petrol);
      doc.image(PRINT_LOGOS.white, 40, 25, { height: 40 });
      doc.fillColor(PRINT_THEME.text).font(PRINT_THEME.fonts.bold).fontSize(18).text("Relatório — Aquisição", 40, 120);
      doc.font(PRINT_THEME.fonts.regular).fontSize(PRINT_THEME.minFontSizePt).text("R$ 57.260,00");
      doc.end();
    });

    const text = buffer.toString("latin1");
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toMatch(/Poppins/);
  });

  it("a paleta de gráficos segue a ordem da marca", () => {
    expect(PRINT_THEME.chart[0]).toBe(PRINT_THEME.brand.cyan);
    expect(PRINT_THEME.chart[4]).toBe(PRINT_THEME.brand.petrol);
  });
});
