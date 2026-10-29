import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PropertyStatementDto } from "@leilao-erp/types";
import { buildStatement, type StatementProperty, type StatementTransaction } from "../finance/property-statement";
import type { ReportContext } from "./builders/context";
import { buildDreContent } from "./builders/dre";
import { NO_SPLIT_RULE_TEXT, buildInvestorContent } from "./builders/investor";
import { statementCards } from "./builders/statement-cards";
import { buildStatementReportContent } from "./builders/statement-report";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import type { ReportContent, TableSection } from "./report-content.types";
import { renderReportExcel } from "./excel-renderer";
import ExcelJS from "exceljs";

const NOW = new Date("2026-10-30T15:00:00.000Z");
const CATS = {
  aquisicao: { id: "c-aq", name: "Aquisição de imóvel", type: "DESPESA" as const },
  impostos: { id: "c-imp", name: "Impostos ", type: "DESPESA" as const },
  reforma: { id: "c-ref", name: "Reforma de imóvel", type: "DESPESA" as const },
  docs: { id: "c-doc", name: "Documentação de imóvel", type: "DESPESA" as const },
  venda: { id: "c-ven", name: "Venda de imóvel", type: "RECEITA" as const },
};

let counter = 0;
function stx(
  category: (typeof CATS)[keyof typeof CATS],
  amount: string,
  date: string,
  overrides: Partial<StatementTransaction> = {},
): StatementTransaction {
  counter += 1;
  return {
    id: `t${counter}`,
    financeAccountId: "acc",
    categoryId: category.id,
    category,
    amount,
    date: new Date(`${date}T00:00:00.000Z`),
    description: `lançamento ${counter}`,
    status: "REALIZADO",
    conciliado: false,
    conciliadoEm: null,
    origemTipo: null,
    investidorId: null,
    investidor: null,
    hasHistory: false,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

const ACQUIRED: StatementProperty = {
  status: "ADQUIRIDA",
  etapa: null,
  avaliacao: "115000",
  dataAquisicao: null,
  canceladoEm: null,
  motivoCancelamento: null,
};

// Alvorada IV · F 201 (dados reais de produção): R$ 57.260,00
const F201_TX = [
  stx(CATS.aquisicao, "38000", "2026-02-03"),
  stx(CATS.impostos, "7200", "2026-02-10"),
  stx(CATS.docs, "600", "2026-03-05"),
  stx(CATS.impostos, "3360", "2026-06-12"),
  stx(CATS.reforma, "3290", "2026-06-20"),
  stx(CATS.reforma, "1450", "2026-07-15"),
  stx(CATS.reforma, "3360", "2026-10-05"),
];

const statementOf = (property: StatementProperty = ACQUIRED, txs = F201_TX): PropertyStatementDto =>
  buildStatement({
    propertyId: "p1",
    property,
    transactions: txs,
    reformaOrcado: "0",
    fluxoMensal: [
      { month: "2026-10", previstoEntradas: "0.00", previstoSaidas: "0.00", realizadoEntradas: "0.00", realizadoSaidas: "3360.00", saldoAcumulado: "-57260.00" },
    ],
    statusFilter: "TODOS",
    now: NOW,
  });

/** Linha como a devolve `listTransactionsForExport` (com conta e imóvel). */
function exportRow(tx: StatementTransaction) {
  return {
    ...tx,
    amount: new Prisma.Decimal(tx.amount),
    financeAccount: { name: "Alvorada 4 bloco F apt 201", property: { origem: "Alvorada IV - F 201" } },
  };
}

function makeCtx(overrides: Record<string, unknown> = {}): ReportContext {
  return {
    prisma: {} as never,
    financeService: {} as never,
    statementService: {} as never,
    dashboardService: {} as never,
    acquisitionService: {} as never,
    legalService: {} as never,
    simulatorService: {} as never,
    salesService: {} as never,
    companyId: "company-1",
    generatedBy: "Ítalo Lima",
    generatedAt: NOW,
    ...overrides,
  } as ReportContext;
}

const tables = (content: ReportContent) => content.sections.filter((s): s is TableSection => s.kind === "table");

describe("statementCards — rótulos por momento do imóvel", () => {
  const labels = (dto: PropertyStatementDto) => statementCards(dto).cards.map((c) => c.label);

  it("adquirido: custo de aquisição, capital investido, avaliação, custos até a venda e resultado projetado", () => {
    expect(labels(statementOf())).toEqual([
      "Custo de aquisição",
      "Capital investido",
      "Avaliação Caixa",
      "Custos até a venda",
      "Resultado projetado",
    ]);
    const cards = statementCards(statementOf()).cards;
    expect(cards[1]!.value).toBe(57260);
    expect(cards[4]).toMatchObject({ value: 57740, highlight: true });
  });

  it("vendido mostra resultado realizado; cancelado mostra reembolsos e perda; nunca 'Lucro líquido'", () => {
    const sold = statementOf({ ...ACQUIRED, status: "VENDIDA" }, [stx(CATS.aquisicao, "60000", "2026-02-03"), stx(CATS.venda, "100000", "2026-09-10")]);
    expect(labels(sold)).toEqual(["Capital investido", "Receitas realizadas", "Resultado realizado"]);

    const cancelled = statementOf({ ...ACQUIRED, status: "AQUISICAO_CANCELADA" });
    expect(labels(cancelled)).toEqual(["Capital investido", "Reembolsos", "Resultado realizado (perda)"]);

    for (const dto of [statementOf(), sold, cancelled]) expect(labels(dto).join(" ")).not.toMatch(/lucro/i);
  });

  it("sem avaliação mostra 'Sem avaliação' em vez de zero", () => {
    const dto = statementOf({ ...ACQUIRED, avaliacao: null });
    const aval = statementCards(dto).cards.find((c) => c.label === "Avaliação Caixa")!;
    expect(aval.value).toBe("Sem avaliação");
  });
});

describe("buildDreContent — F 201", () => {
  async function build(statement = statementOf()) {
    return buildDreContent(
      makeCtx({
        prisma: { property: { findFirst: jest.fn(async () => ({ origem: "Alvorada IV - F 201", endereco: "Parque Nova Friburgo A", cidade: "Cidade Ocidental", estado: "GO" })) } },
        statementService: { getStatement: jest.fn(async () => statement) },
        financeService: { listTransactionsForExport: jest.fn(async () => F201_TX.map(exportRow)) },
      }),
      "p1",
    );
  }

  it("cabeçalho do relatório e conteúdo principal batem com a tela (R$ 57.260,00 e 4 categorias)", async () => {
    const content = await build();
    expect(content).toMatchObject({ typeLabel: "DRE do imóvel", title: "Alvorada IV - F 201", generatedBy: "Ítalo Lima" });

    const cards = content.sections.find((s) => s.kind === "cards");
    expect(cards && cards.kind === "cards" && cards.cards[1]!.value).toBe(57260);

    const composition = content.sections.find((s) => s.kind === "distribution" && s.heading === "Composição do custo");
    expect(composition && composition.kind === "distribution" && composition.items.map((i) => [i.label, i.value, Number(i.percent.toFixed(1))])).toEqual([
      ["Aquisição de imóvel", 38000, 66.4],
      ["Impostos", 10560, 18.4],
      ["Reforma de imóvel", 8100, 14.1],
      ["Documentação de imóvel", 600, 1.0],
    ]);
  });

  it("lista os lançamentos agrupados por categoria, com descrição e 'Pago por', e subtotal", async () => {
    const table = tables(await build()).find((t) => t.heading === "Despesas por categoria")!;
    expect(table.columns.map((c) => c.label)).toEqual(["Data / Categoria", "Descrição", "Pago por", "Status", "Valor"]);
    expect(table.excel).toBe(false);
    // 4 grupos + 7 lançamentos
    expect(table.rows).toHaveLength(11);
    expect(table.highlightRows).toHaveLength(4);
    const first = table.rows[0]!;
    expect(first[0]).toBe("Aquisição de imóvel (1)");
    expect(first[4]).toBe(38000);
    // linha de lançamento: data, descrição, origem, status e valor
    expect(table.rows[1]![2]).toBe("Não informado");
  });

  it("Excel: abas Resumo, Lançamentos (uma linha por lançamento) e Fluxo mensal, nessa ordem", async () => {
    const content = await build();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await renderReportExcel(content)) as never);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["Resumo", "Lançamentos", "Fluxo mensal"]);

    const launches = workbook.getWorksheet("Lançamentos")!;
    expect(launches.rowCount).toBe(1 + F201_TX.length);
    expect(launches.getRow(2).getCell(10).value).toBe(38000);
    expect(launches.getRow(1).values).toEqual(expect.arrayContaining(["Descrição", "Pago por", "Valor"]));
  });

  it("imóvel cancelado ganha a faixa com data e motivo e não tem projeção de venda", async () => {
    const cancelled = statementOf({
      ...ACQUIRED,
      status: "AQUISICAO_CANCELADA",
      canceladoEm: new Date("2026-11-01T00:00:00.000Z"),
      motivoCancelamento: "Desistência dos sócios",
    });
    const content = await build(cancelled);
    const callout = content.sections.find((s) => s.kind === "callout");
    expect(callout).toMatchObject({ tone: "negative" });
    expect(callout && callout.kind === "callout" && callout.title).toContain("01/11/2026");
    expect(callout && callout.kind === "callout" && callout.text).toContain("Desistência dos sócios");
    expect(content.sections.some((s) => s.kind === "waterfall")).toBe(false);
  });

  it("imóvel adquirido traz a cascata da projeção de venda", async () => {
    const waterfall = (await build()).sections.find((s) => s.kind === "waterfall");
    expect(waterfall && waterfall.kind === "waterfall" && waterfall.steps.map((s) => s.value)).toEqual([115000, -57260, -0, 57740]);
  });
});

describe("buildInvestorContent", () => {
  const INVESTOR = { id: "inv-1", name: "Alex Alves de Lima" };
  const paid = (amount: string, date = "2026-02-03") => ({
    ...stx(CATS.aquisicao, amount, date, { origemTipo: "INVESTIDOR", investidorId: "inv-1" }),
    amount: new Prisma.Decimal(amount),
    category: CATS.aquisicao,
    financeAccount: { name: "Conta", propertyId: "p1", property: { origem: "Alvorada IV - F 201" } },
  });

  function ctxFor(options: { participation?: { percentual: string; distributions: unknown[] } | null; txs?: unknown[]; investor?: unknown } = {}) {
    const findMany = jest.fn(async () => options.txs ?? [paid("57260")]);
    const ctx = makeCtx({
      prisma: {
        investor: { findFirst: jest.fn(async () => (options.investor === undefined ? INVESTOR : options.investor)) },
        transaction: { findMany },
        propertyInvestor: { findFirst: jest.fn(async () => options.participation ?? null) },
        property: { findFirst: jest.fn(async () => ({ origem: "Alvorada IV - F 201" })) },
      },
      statementService: { getStatement: jest.fn(async () => statementOf()) },
    });
    return { ctx, findMany };
  }

  const propertyTable = (content: ReportContent) => tables(content).find((t) => t.heading === "Participação por imóvel")!;

  it("sem participação cadastrada: mostra a participação no custo e 'Divisão de resultado não configurada'", async () => {
    const { ctx } = ctxFor();
    const { content } = await buildInvestorContent(ctx, { investorId: "inv-1" });
    const row = propertyTable(content).rows[0]!;
    expect(row[2]).toBe(57260); // pago pelo investidor
    expect(row[3]).toBeCloseTo(100, 5); // % do custo incorrido do imóvel
    expect(row[4]).toBe("Projetado");
    expect(row[7]).toBe(NO_SPLIT_RULE_TEXT);
    expect(content.sections.some((s) => s.kind === "callout")).toBe(true);
    expect(content.orientation).toBe("landscape");
  });

  it("com participação: resultado atribuível = resultado × percentual, bruto; mostra as distribuições registradas", async () => {
    const { ctx } = ctxFor({
      participation: {
        percentual: "40",
        distributions: [
          {
            lucroBase: new Prisma.Decimal(50000),
            percentualAplicado: new Prisma.Decimal(40),
            valorBruto: new Prisma.Decimal(20000),
            valorIR: new Prisma.Decimal(3000),
            valorLiquido: new Prisma.Decimal(17000),
            status: "PAGO",
            dataPagamento: new Date("2026-09-01T00:00:00.000Z"),
          },
        ],
      },
    });
    const { content } = await buildInvestorContent(ctx, { investorId: "inv-1" });
    const row = propertyTable(content).rows[0]!;
    expect(row[6]).toBe(40);
    expect((row[7] as { value: number }).value).toBeCloseTo(23096, 2); // 57.740 × 40%
    expect(content.sections.some((s) => s.kind === "callout")).toBe(false);
    const distributions = tables(content).find((t) => t.heading === "Distribuições de lucro registradas")!;
    expect(distributions.rows[0]!.slice(5)).toEqual([17000, "Pago", new Date("2026-09-01T00:00:00.000Z")]);
  });

  it("% do custo usa o que ele pagou sobre o custo total do imóvel (todos os pagadores)", async () => {
    const { ctx } = ctxFor({ txs: [paid("20000")] });
    const { content } = await buildInvestorContent(ctx, { investorId: "inv-1" });
    expect(propertyTable(content).rows[0]![3]).toBeCloseTo((20000 / 57260) * 100, 5);
    const cards = content.sections.find((s) => s.kind === "cards");
    expect(cards && cards.kind === "cards" && cards.cards[0]!.value).toBe(20000);
  });

  it("o período filtra os pagamentos (de/até inclusivos) e aparece no contexto", async () => {
    const { ctx, findMany } = ctxFor();
    const { content, contexto } = await buildInvestorContent(ctx, { investorId: "inv-1", from: "2026-01-01", to: "2026-10-30" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          origemTipo: "INVESTIDOR",
          investidorId: "inv-1",
          status: { not: "CANCELADO" },
          date: { gte: new Date("2026-01-01T00:00:00.000Z"), lte: new Date("2026-10-30T23:59:59.999Z") },
        }),
      }),
    );
    expect(contexto).toBe("Alex Alves de Lima · 01/01/2026 a 30/10/2026");
    expect(content.subtitle).toContain("Período: 01/01/2026 a 30/10/2026");
  });

  it("não aceita investidor de outra empresa", async () => {
    const { ctx } = ctxFor({ investor: null });
    await expect(buildInvestorContent(ctx, { investorId: "inv-x" })).rejects.toThrow(BadRequestException);
  });

  it("lança só despesas realizadas no total; previstos aparecem à parte", async () => {
    const previsto = { ...paid("1000"), status: "PREVISTO" as const };
    const { ctx } = ctxFor({ txs: [paid("57260"), previsto] });
    const { content } = await buildInvestorContent(ctx, { investorId: "inv-1" });
    const cards = content.sections.find((s) => s.kind === "cards");
    expect(cards && cards.kind === "cards" && cards.cards.map((c) => [c.label, c.value])).toEqual([
      ["Total pago pelo investidor", 57260],
      ["Imóveis", 1],
      ["Lançamentos pagos", 1],
      ["Previsto a pagar", 1000],
    ]);
  });
});

describe("buildStatementReportContent (extrato)", () => {
  const rows = [
    exportRow(stx(CATS.aquisicao, "38000", "2026-02-03", { origemTipo: "INVESTIDOR", investidorId: "i1", investidor: { id: "i1", name: "Ítalo" } })),
    exportRow(stx(CATS.impostos, "10560", "2026-02-10")),
    exportRow(stx(CATS.venda, "1000", "2026-03-10")),
    exportRow(stx(CATS.docs, "999", "2026-04-10", { status: "CANCELADO" })),
  ];

  function ctxWith(list = rows) {
    const listTransactionsForExport = jest.fn(async () => list);
    const ctx = makeCtx({
      financeService: { listTransactionsForExport },
      prisma: {
        property: { findFirst: jest.fn(async () => ({ origem: "Alvorada IV - F 201" })) },
        financeAccount: { findFirst: jest.fn(async () => null) },
        financeCategory: { findFirst: jest.fn(async () => null) },
        investor: { findFirst: jest.fn(async () => null) },
      },
    });
    return { ctx, listTransactionsForExport };
  }

  it("lista todos os lançamentos (inclusive cancelado) mas não soma o cancelado nos totais", async () => {
    const { ctx } = ctxWith();
    const { content } = await buildStatementReportContent(ctx, {});
    const [launches, byCategory, byOrigin] = tables(content);
    expect(launches!.rows).toHaveLength(4);
    expect(byCategory!.rows.map((r) => [r[0], r[3]])).toEqual([
      ["Aquisição de imóvel", 38000],
      ["Impostos", 10560],
      ["Venda de imóvel", 1000],
    ]);
    expect(byCategory!.footer![3]).toBe(1000 - 38000 - 10560); // receitas − despesas
    expect(byOrigin!.rows.map((r) => [r[0], r[2]])).toEqual([
      ["Ítalo", 38000],
      ["Não informado", 10560],
    ]);
    expect(content.orientation).toBe("landscape");
  });

  it("repassa os filtros (período em UTC) e descreve o contexto", async () => {
    const { ctx, listTransactionsForExport } = ctxWith();
    const { contexto } = await buildStatementReportContent(ctx, {
      propertyId: "p1",
      from: "2026-01-01",
      to: "2026-10-30",
      status: "REALIZADO",
      origem: "EMPRESA",
    });
    expect(listTransactionsForExport).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ propertyId: "p1", status: "REALIZADO", origem: "EMPRESA", from: "2026-01-01T00:00:00.000Z", to: "2026-10-30T23:59:59.999Z" }),
    );
    expect(contexto).toBe("Imóvel: Alvorada IV - F 201 · Período: 01/01/2026 a 30/10/2026 · Status: Realizado · Pago por: Caixa da empresa");
  });

  it("sem filtros, o contexto é 'Todos os lançamentos'; filtro Cancelados soma os cancelados", async () => {
    const { ctx } = ctxWith();
    expect((await buildStatementReportContent(ctx, {})).contexto).toBe("Todos os lançamentos");
    const { content } = await buildStatementReportContent(ctx, { status: "CANCELADO" });
    expect(tables(content)[1]!.rows.map((r) => r[0])).toContain("Documentação de imóvel");
  });
});

describe("ReportsService e controlador", () => {
  function makeService() {
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ name: "Ítalo Lima" })) },
      property: { findFirst: jest.fn(async () => ({ id: "p1", origem: "Alvorada IV - F 201" })) },
      financeAccount: { findFirst: jest.fn(async () => null) },
      financeCategory: { findFirst: jest.fn(async () => null) },
      investor: { findFirst: jest.fn(async () => null) },
      report: {
        create: jest.fn(async ({ data }) => ({ id: "r1", ...data, property: null, generatedBy: { id: "u1", name: "Ítalo Lima" } })),
        findMany: jest.fn(async () => []),
      },
    };
    const storage = { uploadBuffer: jest.fn(async () => undefined), createDownloadUrl: jest.fn(async () => "https://download") };
    const audit = { log: jest.fn(async () => undefined) };
    const finance = {
      listTransactionsForExport: jest.fn(async () => []),
      getSummary: jest.fn(async () => ({ saldoConsolidado: "-100.00", totalReceitasMes: "0.00", totalDespesasMes: "100.00" })),
      getCompanyCashflow: jest.fn(async () => []),
    };
    const service = new ReportsService(
      prisma as never,
      storage as never,
      audit as never,
      {} as never,
      {} as never,
      finance as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, storage };
  }

  it("gera o PDF, envia ao storage e guarda quem gerou e o contexto dos filtros no histórico", async () => {
    const { service, prisma, storage } = makeService();
    const result = await service.generateReport("company-1", "u1", {
      type: "TRANSACTION_STATEMENT",
      format: "PDF",
      propertyId: "p1",
      from: "2026-01-01",
      to: "2026-10-30",
    });

    const [key, buffer, mime] = storage.uploadBuffer.mock.calls[0] as unknown as [string, Buffer, string];
    expect(key).toMatch(/^companies\/company-1\/reports\/.+\.pdf$/);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(mime).toBe("application/pdf");

    const data = (prisma.report.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({
      type: "TRANSACTION_STATEMENT",
      format: "PDF",
      propertyId: "p1",
      generatedById: "u1",
      filters: { from: "2026-01-01", to: "2026-10-30", contexto: "Imóvel: Alvorada IV - F 201 · Período: 01/01/2026 a 30/10/2026" },
    });
    expect(result).toMatchObject({ downloadUrl: "https://download" });
    expect(result).not.toHaveProperty("storageKey");
  });

  it("Excel sai como planilha (.xlsx) e relatório sem filtros não grava 'filters'", async () => {
    const { service, prisma, storage } = makeService();
    await service.generateReport("company-1", "u1", { type: "FINANCIAL_CASHFLOW_GERAL", format: "EXCEL" });
    const [key, buffer, mime] = storage.uploadBuffer.mock.calls[0] as unknown as [string, Buffer, string];
    expect(key).toMatch(/\.xlsx$/);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(mime).toContain("spreadsheetml");
    expect((prisma.report.create.mock.calls[0] as unknown as [{ data: { filters?: unknown } }])[0].data.filters).toBeUndefined();
  });

  it("contas ligadas a investidor ou corretor não veem a lista de relatórios da empresa", () => {
    const listReports = jest.fn(async () => [{ id: "r1" }]);
    const controller = new ReportsController({ listReports } as never);
    const staff = { companyId: "company-1", id: "u1" } as never;
    expect(controller.list({ ...(staff as object), investorId: "inv-1" } as never)).toEqual([]);
    expect(controller.list({ ...(staff as object), brokerId: "b-1" } as never)).toEqual([]);
    expect(listReports).not.toHaveBeenCalled();
    void controller.list(staff);
    expect(listReports).toHaveBeenCalledWith("company-1");
  });
});
