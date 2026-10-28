import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { buildTransactionsWorkbook, type ExportTransactionRow } from "./transactions-export";

function row(overrides: Partial<ExportTransactionRow> = {}): ExportTransactionRow {
  return {
    id: "tx-1",
    financeAccountId: "acc-1",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Aquisição", type: "DESPESA" },
    amount: new Prisma.Decimal("57800"),
    date: new Date("2026-10-26T00:00:00.000Z"),
    description: "Aquisição de imóvel Caixa - boleto",
    status: "REALIZADO",
    conciliado: false,
    conciliadoEm: null,
    origemTipo: "INVESTIDOR",
    investidorId: "inv-1",
    investidor: { id: "inv-1", name: "Ítalo" },
    contaOrigemId: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    financeAccount: { name: "Alvorada III · H 02", property: { origem: "Alvorada III · H 02 (Garden)" } },
    ...overrides,
  };
}

async function load(rows: ExportTransactionRow[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await buildTransactionsWorkbook(rows)) as never);
  return workbook.getWorksheet("Lançamentos")!;
}

describe("buildTransactionsWorkbook", () => {
  it("gera uma linha por lançamento, com descrição, 'Pago por' e valor numérico", async () => {
    const sheet = await load([
      row(),
      row({ id: "tx-2", amount: new Prisma.Decimal("600"), origemTipo: null, investidorId: null, investidor: null, description: null }),
      row({ id: "tx-3", origemTipo: "EMPRESA", investidorId: null, investidor: null, category: { id: "c2", name: "Venda", type: "RECEITA" } }),
    ]);

    expect(sheet.rowCount).toBe(4); // cabeçalho + 3 lançamentos
    expect(sheet.getRow(1).values).toEqual(
      expect.arrayContaining(["Data", "Imóvel", "Conta de caixa", "Tipo", "Categoria", "Descrição", "Pago por", "Status", "Conciliado", "Valor"]),
    );

    const first = sheet.getRow(2);
    expect(first.getCell(6).value).toBe("Aquisição de imóvel Caixa - boleto");
    expect(first.getCell(7).value).toBe("Ítalo");
    expect(first.getCell(10).value).toBe(57800); // número, não texto
    expect(first.getCell(4).value).toBe("Despesa");
    expect((first.getCell(1).value as Date).toISOString().slice(0, 10)).toBe("2026-10-26");

    expect(sheet.getRow(3).getCell(7).value).toBe("Não informado");
    expect(sheet.getRow(4).getCell(7).value).toBe("Caixa da empresa");
    expect(sheet.getRow(4).getCell(4).value).toBe("Receita");
  });

  it("congela o cabeçalho e aplica filtro automático", async () => {
    const sheet = await load([row()]);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("gera planilha só com cabeçalho quando não há lançamentos", async () => {
    expect((await load([])).rowCount).toBe(1);
  });
});
