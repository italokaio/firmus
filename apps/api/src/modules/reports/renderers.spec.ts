import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PRINT_THEME, createReportSchema } from "@leilao-erp/types";
import { renderReportExcel } from "./excel-renderer";
import { renderReportPdf } from "./pdf-renderer";
import type { ReportContent } from "./report-content.types";
import { formatBRL, formatForPdf, formatPercentBR } from "./report-format";

const GENERATED_AT = new Date("2026-10-30T15:00:00.000Z");

function sample(overrides: Partial<ReportContent> = {}, rows = 120): ReportContent {
  return {
    typeLabel: "DRE do imóvel",
    title: "Alvorada IV - F 201",
    subtitle: "Parque Nova Friburgo A · Cidade Ocidental/GO",
    generatedAt: GENERATED_AT,
    generatedBy: "Ítalo Lima",
    sections: [
      {
        kind: "cards",
        cards: [
          { label: "Capital investido", value: 57260, format: "currency", subtitle: "Despesas realizadas" },
          { label: "Custos até a venda", value: 0, format: "currency", tone: "forecast" },
          { label: "Resultado projetado", value: 57740, format: "currency", highlight: true, subtitle: "Margem 50,2%" },
        ],
      },
      { kind: "kv", heading: "Visão geral", rows: [{ label: "Status", value: "Adquirida" }, { label: "Área", value: 44, format: "integer" }] },
      {
        kind: "distribution",
        heading: "Composição do custo",
        items: [
          { label: "Aquisição", value: 38000, percent: 66.4 },
          { label: "Impostos", value: 10560, percent: 18.4 },
          { label: "Sem origem", value: 8700, percent: 15.2, tone: "cancelled" },
        ],
      },
      {
        kind: "columns",
        heading: "Capital acumulado",
        categories: ["02/2026", "03/2026", "06/2026"],
        bars: { label: "No mês", values: [45200, 600, 6650] },
        line: { label: "Acumulado", values: [45200, 45800, 52450] },
      },
      {
        kind: "waterfall",
        heading: "Projeção",
        steps: [
          { label: "Avaliação", value: 115000 },
          { label: "Custo", value: -57260, tone: "realized" },
          { label: "Resultado", value: 57740, total: true },
        ],
      },
      { kind: "callout", tone: "negative", title: "Aquisição cancelada", text: "Motivo: desistência dos sócios." },
      {
        kind: "table",
        heading: "Lançamentos",
        columns: [
          { label: "Data", format: "date" },
          { label: "Descrição" },
          { label: "Status" },
          { label: "Valor", format: "currency" },
        ],
        rows: Array.from({ length: rows }, (_, i) => [
          new Date(Date.UTC(2026, 1, 1 + (i % 28))),
          `Lançamento número ${i + 1} com descrição`,
          { value: i % 2 ? "Previsto" : "Realizado", tone: i % 2 ? ("forecast" as const) : ("realized" as const) },
          100 + i,
        ]),
        footer: ["Total", null, null, 12345.67],
      },
    ],
    ...overrides,
  };
}

/** Registra tudo que o pdfkit desenha, para testar o layout sem precisar ler o PDF binário. */
function spyOnPdfKit() {
  const texts: string[] = [];
  const fontSizes: number[] = [];
  const fills: unknown[] = [];
  const proto = PDFDocument.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  const originals = { text: proto.text!, fontSize: proto.fontSize!, fill: proto.fill! };
  proto.text = function (this: unknown, ...args: unknown[]) {
    if (typeof args[0] === "string") texts.push(args[0]);
    return originals.text.apply(this, args);
  };
  proto.fontSize = function (this: unknown, ...args: unknown[]) {
    if (typeof args[0] === "number") fontSizes.push(args[0]);
    return originals.fontSize.apply(this, args);
  };
  proto.fill = function (this: unknown, ...args: unknown[]) {
    fills.push(args[0]);
    return originals.fill.apply(this, args);
  };
  return {
    texts,
    fontSizes,
    fills,
    restore: () => Object.assign(proto, originals),
  };
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;

describe("renderReportPdf — layout de marca", () => {
  let spy: ReturnType<typeof spyOnPdfKit>;
  beforeEach(() => {
    spy = spyOnPdfKit();
  });
  afterEach(() => spy.restore());

  it("gera um PDF A4 de várias páginas, com rodapé 'Página X de Y' em todas", async () => {
    const pdf = await renderReportPdf(sample());
    const pages = pageCount(pdf);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pages).toBeGreaterThan(2);
    for (let i = 1; i <= pages; i += 1) expect(spy.texts).toContain(`Página ${i} de ${pages}`);
    expect(spy.texts.filter((t) => t === "FGI · Firmus Gestão Imobiliária")).toHaveLength(pages);
  });

  it("1ª página: tipo em caixa alta, título, contexto e 'Gerado em dd/mm/aaaa por {usuário}'", async () => {
    await renderReportPdf(sample());
    expect(spy.texts).toContain("DRE DO IMÓVEL");
    expect(spy.texts).toContain("Alvorada IV - F 201");
    expect(spy.texts).toContain("Parque Nova Friburgo A · Cidade Ocidental/GO");
    expect(spy.texts).toContain("Gerado em 30/10/2026 por Ítalo Lima");
  });

  it("páginas seguintes usam o cabeçalho compacto (título repetido) e o fundo tingido, não branco", async () => {
    const pdf = await renderReportPdf(sample());
    const pages = pageCount(pdf);
    // título aparece uma vez no cabeçalho grande e uma vez por página seguinte no compacto
    expect(spy.texts.filter((t) => t === "Alvorada IV - F 201")).toHaveLength(pages);
    expect(spy.fills.filter((c) => c === PRINT_THEME.page.background)).toHaveLength(pages);
    expect(PRINT_THEME.page.background.toUpperCase()).not.toBe("#FFFFFF");
  });

  it("o cabeçalho da tabela se repete a cada página em que ela continua", async () => {
    await renderReportPdf(sample());
    const headers = spy.texts.filter((t) => t === "Descrição");
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it("nenhum texto fica abaixo de 9 pt", async () => {
    await renderReportPdf(sample());
    expect(Math.min(...spy.fontSizes)).toBeGreaterThanOrEqual(PRINT_THEME.minFontSizePt);
  });

  it("formata valores em pt-BR: R$ 1.234,56, negativos com sinal de menos e datas dd/mm/aaaa", async () => {
    await renderReportPdf(sample());
    // O Intl usa espaço não separável entre "R$" e o número (evita quebra de linha): normaliza para comparar.
    const plain = (text: string) => text.replace(/\u00a0/g, " ");
    expect(spy.texts.map(plain)).toContain("R$ 57.260,00");
    expect(spy.texts).toContain("01/02/2026");
    expect(plain(formatBRL(-1234.56))).toBe("−R$ 1.234,56");
    expect(plain(formatBRL(1234.56))).toBe("R$ 1.234,56");
    expect(formatPercentBR(52)).toBe("52,0%");
  });

  it("orientação paisagem muda o tamanho da página", async () => {
    const landscape = await renderReportPdf(sample({ orientation: "landscape" }, 5));
    const portrait = await renderReportPdf(sample({}, 5));
    expect(landscape.toString("latin1")).toMatch(/MediaBox \[0 0 841\.89 595\.28\]/);
    expect(portrait.toString("latin1")).toMatch(/MediaBox \[0 0 595\.28 841\.89\]/);
  });

  it("seção sem registros mostra 'Sem registros.' e célula nula mostra '—'", async () => {
    await renderReportPdf(
      sample({ sections: [{ kind: "table", heading: "Vazia", columns: [{ label: "A" }], rows: [] }] }),
    );
    expect(spy.texts).toContain("Sem registros.");
    expect(formatForPdf(null)).toBe("—");
    expect(formatForPdf("")).toBe("");
  });
});

async function loadExcel(content: ReportContent) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await renderReportExcel(content)) as never);
  return workbook;
}

describe("renderReportExcel — planilha de marca", () => {
  it("agrupa seções por aba, na ordem em que aparecem, e não leva gráficos de PDF", async () => {
    const content = sample({
      sections: [
        { kind: "cards", cards: [{ label: "Capital", value: 1000, format: "currency" }] },
        { kind: "columns", heading: "Gráfico", categories: ["a"], bars: { label: "x", values: [1] } },
        { kind: "waterfall", heading: "Cascata", steps: [{ label: "a", value: 1 }] },
        { kind: "table", heading: "Lançamentos", sheet: "Lançamentos", columns: [{ label: "A" }], rows: [["x"]] },
        { kind: "table", heading: "Fluxo", sheet: "Fluxo mensal", columns: [{ label: "A" }], rows: [["y"]] },
      ],
    });
    const wb = await loadExcel(content);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Resumo", "Lançamentos", "Fluxo mensal"]);
  });

  it("respeita pdf:false / excel:false por seção", async () => {
    const content = sample({
      sections: [
        { kind: "table", heading: "Só PDF", excel: false, columns: [{ label: "A" }], rows: [["x"]] },
        { kind: "table", heading: "Só Excel", pdf: false, sheet: "Dados", columns: [{ label: "A" }], rows: [["y"]] },
      ],
    });
    const wb = await loadExcel(content);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Dados"]);
  });

  it("aba só com uma tabela: cabeçalho na linha 1, congelado, com filtro; valores numéricos e datas de verdade", async () => {
    const content = sample({
      sections: [
        {
          kind: "table",
          heading: "Lançamentos",
          sheet: "Lançamentos",
          columns: [{ label: "Data", format: "date" }, { label: "Valor", format: "currency" }, { label: "Margem", format: "percent" }],
          rows: [[new Date("2026-10-26T00:00:00.000Z"), 57800, 52]],
          footer: ["Total", 57800, null],
        },
      ],
    });
    const sheet = (await loadExcel(content)).getWorksheet("Lançamentos")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("Data");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBeTruthy();

    const row = sheet.getRow(2);
    expect((row.getCell(1).value as Date).toISOString().slice(0, 10)).toBe("2026-10-26");
    expect(row.getCell(2).value).toBe(57800);
    expect(row.getCell(2).numFmt).toContain("R$");
    expect(row.getCell(3).value).toBeCloseTo(0.52); // percentual gravado como fração, formatado 0,0%
    expect(row.getCell(3).numFmt).toBe("0.0%");
    expect(sheet.getRow(3).getCell(1).font?.bold).toBe(true); // linha de totais
  });

  it("aba com várias seções começa por título/contexto/'Gerado por' e cards viram Indicador/Valor", async () => {
    const sheet = (await loadExcel(sample())).getWorksheet("Resumo")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("Alvorada IV - F 201");
    expect(String(sheet.getRow(3).getCell(1).value)).toBe("Gerado em 30/10/2026 por Ítalo Lima");
    let capital: ExcelJS.Row | undefined;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === "Capital investido") capital = row;
    });
    expect(capital!.getCell(2).value).toBe(57260);
    expect(capital!.getCell(2).numFmt).toContain("R$");
  });

  it("distribuição vira tabela Item / Valor / %", async () => {
    const sheet = (await loadExcel(sample())).getWorksheet("Resumo")!;
    let impostos: ExcelJS.Row | undefined;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === "Impostos") impostos = row;
    });
    expect(impostos!.getCell(2).value).toBe(10560);
    expect(impostos!.getCell(3).value).toBeCloseTo(0.184);
  });

  it("cor semântica do valor: previsto em âmbar (texto escuro, legível)", async () => {
    const sheet = (
      await loadExcel(
        sample({
          sections: [
            { kind: "table", heading: "T", sheet: "T", columns: [{ label: "S" }], rows: [[{ value: "Previsto", tone: "forecast" }]] },
          ],
        }),
      )
    ).getWorksheet("T")!;
    expect(sheet.getRow(2).getCell(1).font?.color?.argb).toBe("FF926100");
  });
});

describe("createReportSchema", () => {
  const base = { format: "PDF" as const };

  it("DRE e Dossiê exigem imóvel; Relatório para Investidor exige investidor", () => {
    expect(createReportSchema.safeParse({ ...base, type: "FINANCIAL_DRE" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...base, type: "PROPERTY_DETAIL" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...base, type: "INVESTOR_REPORT" }).success).toBe(false);
    expect(
      createReportSchema.safeParse({ ...base, type: "INVESTOR_REPORT", investorId: "5e4a582f-c4b8-403a-a98c-3f6250337db1" }).success,
    ).toBe(true);
  });

  it("Extrato e demais não exigem nada; período invertido é rejeitado", () => {
    expect(createReportSchema.safeParse({ ...base, type: "TRANSACTION_STATEMENT" }).success).toBe(true);
    expect(createReportSchema.safeParse({ ...base, type: "PORTFOLIO_SUMMARY" }).success).toBe(true);
    expect(
      createReportSchema.safeParse({ ...base, type: "TRANSACTION_STATEMENT", from: "2026-10-30", to: "2026-01-01" }).success,
    ).toBe(false);
    expect(
      createReportSchema.safeParse({ ...base, type: "TRANSACTION_STATEMENT", from: "2026-01-01", to: "2026-10-30" }).success,
    ).toBe(true);
  });
});
