import { Prisma } from "@prisma/client";
import { CANCELLED_TRANSACTION_MESSAGE, FinanceService } from "./finance.service";

const COMPANY = "company-1";
const ACCOUNT = "account-1";

function tx(overrides: Record<string, unknown>) {
  return {
    id: "t",
    categoryId: "c",
    category: { id: "c", name: "Reforma", type: "DESPESA" },
    amount: new Prisma.Decimal("100"),
    date: new Date("2026-10-10T00:00:00.000Z"),
    description: null,
    status: "REALIZADO",
    conciliado: false,
    origemTipo: null,
    investidorId: null,
    investidor: null,
    ...overrides,
  };
}

function setup(transactions: unknown[]) {
  const prisma = {
    financeAccount: {
      findFirst: jest.fn(async () => ({ id: ACCOUNT, companyId: COMPANY })),
      findMany: jest.fn(async () => [{ saldoInicial: new Prisma.Decimal(0) }]),
    },
    transaction: {
      findFirst: jest.fn(async () => transactions[0]),
      findMany: jest.fn(async () => transactions),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };
  return { service: new FinanceService(prisma as never, audit as never), prisma };
}

describe("lançamento CANCELADO", () => {
  it("é somente leitura: não edita nem exclui", async () => {
    const { service, prisma } = setup([tx({ status: "CANCELADO" })]);
    await expect(service.updateTransaction(COMPANY, ACCOUNT, "t", { description: "x" })).rejects.toThrow(
      CANCELLED_TRANSACTION_MESSAGE,
    );
    await expect(service.deleteTransaction(COMPANY, ACCOUNT, "t")).rejects.toThrow(CANCELLED_TRANSACTION_MESSAGE);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.transaction.delete).not.toHaveBeenCalled();
  });

  it("não entra no fluxo de caixa consolidado (nem como previsto, nem como realizado)", async () => {
    const { service } = setup([
      tx({ id: "a", status: "REALIZADO", amount: new Prisma.Decimal("57260") }),
      tx({ id: "b", status: "PREVISTO", amount: new Prisma.Decimal("1000") }),
      tx({ id: "c", status: "CANCELADO", amount: new Prisma.Decimal("5000") }),
      tx({ id: "d", status: "CANCELADO", amount: new Prisma.Decimal("700"), category: { id: "r", name: "Venda", type: "RECEITA" } }),
    ]);
    const [oct] = await service.getCompanyCashflow(COMPANY);
    expect(oct).toMatchObject({
      month: "2026-10",
      previstoSaidas: "1000.00",
      previstoEntradas: "0.00",
      realizadoSaidas: "57260.00",
      realizadoEntradas: "0.00",
      saldoAcumulado: "-57260.00",
    });
  });

  it("não entra na soma por origem, salvo se o filtro pedir o status CANCELADO", async () => {
    const { service, prisma } = setup([]);
    await service.getTotalsByOrigin(COMPANY, {});
    expect(prisma.transaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: "CANCELADO" } }) }),
    );
    await service.getTotalsByOrigin(COMPANY, { status: "CANCELADO" });
    expect(prisma.transaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "CANCELADO" }) }),
    );
  });
});
