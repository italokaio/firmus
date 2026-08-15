import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import type { ReportContent } from "./report-content.types";

/** Renderiza o PDF em memória (sem tocar disco) e resolve com o buffer final. */
export async function renderReportPdf(content: ReportContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text(content.title);
    doc.fontSize(9).font("Helvetica").fillColor("#666666").text(content.subtitle);
    doc.fillColor("#000000");
    doc.moveDown();

    for (const section of content.sections) {
      if (doc.y > doc.page.height - 150) doc.addPage();

      doc.fontSize(13).font("Helvetica-Bold").text(section.heading);
      doc.moveDown(0.3);

      if (section.kind === "kv") {
        doc.fontSize(10).font("Helvetica");
        for (const [label, value] of section.rows) {
          doc.text(`${label}: ${value}`);
        }
      } else {
        // pdfkit não tem layout de tabela nativo; alinhamos por fonte
        // monoespaçada com padding manual — simples e robusto o suficiente
        // para os volumes de linhas destes relatórios.
        const widths = section.columns.map((col, i) =>
          Math.max(col.length, ...section.rows.map((row) => String(row[i] ?? "").length)),
        );
        doc
          .fontSize(9)
          .font("Courier-Bold")
          .text(section.columns.map((col, i) => col.padEnd(widths[i] ?? col.length)).join("  "));
        doc.font("Courier");
        for (const row of section.rows) {
          doc.text(row.map((cell, i) => String(cell).padEnd(widths[i] ?? 0)).join("  "));
        }
      }
      doc.moveDown();
    }

    doc.end();
  });
}

export async function renderReportExcel(content: ReportContent): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Firmus - Gestão Imobiliária";
  workbook.created = new Date();

  for (const section of content.sections) {
    const sheet = workbook.addWorksheet(section.heading.slice(0, 31));
    if (section.kind === "kv") {
      sheet.columns = [
        { header: "Campo", key: "campo", width: 32 },
        { header: "Valor", key: "valor", width: 42 },
      ];
      sheet.getRow(1).font = { bold: true };
      for (const [campo, valor] of section.rows) {
        sheet.addRow({ campo, valor });
      }
    } else {
      sheet.columns = section.columns.map((col) => ({ header: col, key: col, width: 22 }));
      sheet.getRow(1).font = { bold: true };
      for (const row of section.rows) {
        sheet.addRow(row);
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
