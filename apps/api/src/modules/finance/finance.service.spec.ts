import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FinanceService } from "./finance.service";
import { CONCILIADO_LOCK_MESSAGE } from "./transaction-rules";

const COMPANY = "company-1";
const ACCOUNT = "account-1";
const TX_ID = "tx-1";

function makeExisting(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    financeAccountId: ACCOUNT,
    categoryId: "cat-despesa-1",
    category: { id: "cat-despesa-1", name: "Aquisição", type: "DESPESA" },
    amount: new Prisma.Decimal("57800"),
    date: new Date("2026-10-26T00:00:00.000Z"),
    description: "Boleto",
    status: "REALIZADO",
    conciliado: false,
    conciliadoEm: null,
    origemTipo: null,
    investidorId: null,
    investidor: null,
    ...overrides,
  };
}

function setup(existing = makeExisting()) {
  const txClient = {
    transaction: { update: jest.fn(async ({ data }) => ({ ...existing, ...data, category: existing.category, investidor: null })) },
  };
  const prisma = {
    financeAccount: { findFirst: jest.fn(async () => ({ id: ACCOUNT, companyId: COMPANY })) },
    transaction: { findFirst: jest.fn(async () => existing) },
    financeCategory: {
      findFirst: jest.fn(async ({ where }) => {
        if (where.id === "cat-despesa-2") return { id: "cat-despesa-2", name: "Impostos", type: "DESPESA" };
        if (where.id === "cat-receita-1") return { id: "cat-receita-1", name: "Venda", type: "RECEITA" };
        return null;
      }),
    },
    investor: {
      findFirst: jest.fn(async ({ where }) => (where.id === "inv-1" ? { id: "inv-1", name: "Ítalo" } : null)),
    },
    auditLog: { count: jest.fn(async () => 0) },
    $transaction: jest.fn(async (fn) => fn(txClient)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audit = { log: jest.fn(async (_params: Record<string, any>) => undefined) };
  const service = new FinanceService(prisma as never, audit as never);
  return { service, prisma, audit, txClient };
}

describe("FinanceService.updateTransaction", () => {
  it("edita vários campos e grava uma linha de histórico por campo, na mesma transação", async () => {
    const { service, audit, txClient } = setup();
    await service.updateTransaction(COMPANY, ACCOUNT, TX_ID, {
      amount: "60000",
      description: "Boleto corrigido",
      origemTipo: "INVESTIDOR",
      investidorId: "inv-1",
    });

    expect(txClient.transaction.update).toHaveBeenCalledTimes(1);
    const fields = audit.log.mock.calls.map(([call]) => call.after.campo);
    expect(fields).toEqual(["Valor", "Descrição", "Pago por"]);
    for (const [call] of audit.log.mock.calls) {
      expect(call.client).toBe(txClient);
      expect(call.action).toBe("UPDATE");
    }
  });

  it("não grava nada quando a edição não muda nenhum valor", async () => {
    const { service, audit, prisma } = setup();
    await service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { amount: "57800.00", description: "Boleto" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("rejeita investidor inexistente na empresa", async () => {
    const { service, prisma } = setup();
    await expect(
      service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { origemTipo: "INVESTIDOR", investidorId: "inv-x" }),
    ).rejects.toThrow("Investidor informado não existe nesta empresa");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita trocar para categoria de outro tipo (despesa → receita)", async () => {
    const { service } = setup();
    await expect(
      service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { categoryId: "cat-receita-1" }),
    ).rejects.toThrow("mesmo tipo");
  });

  it("aceita trocar para outra categoria do mesmo tipo", async () => {
    const { service, audit } = setup();
    await service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { categoryId: "cat-despesa-2" });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ before: { campo: "Categoria", valor: "Aquisição" }, after: { campo: "Categoria", valor: "Impostos" } }),
    );
  });

  it("rejeita categoria que não pertence à empresa e valor zero", async () => {
    const { service } = setup();
    await expect(service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { categoryId: "outra-empresa" })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { amount: "0" })).rejects.toThrow(
      "maior que zero",
    );
  });

  it("limpar a origem (null) remove o investidor e registra no histórico", async () => {
    const existing = makeExisting({
      origemTipo: "INVESTIDOR",
      investidorId: "inv-1",
      investidor: { id: "inv-1", name: "Ítalo" },
    });
    const { service, audit, txClient } = setup(existing);
    await service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { origemTipo: null, investidorId: null });
    expect(txClient.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ origemTipo: null, investidorId: null }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ after: { campo: "Pago por", valor: "Não informado" } }),
    );
  });

  describe("lançamento conciliado (P6)", () => {
    const conciliado = () => makeExisting({ conciliado: true, conciliadoEm: new Date() });

    it("bloqueia valor, data e status com a mensagem definida", async () => {
      const { service, prisma } = setup(conciliado());
      for (const patch of [{ amount: "1" }, { date: "2026-01-01T00:00:00.000Z" }, { status: "PREVISTO" as const }]) {
        await expect(service.updateTransaction(COMPANY, ACCOUNT, TX_ID, patch)).rejects.toThrow(CONCILIADO_LOCK_MESSAGE);
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("permite descrição e 'Pago por', e permite desfazer a conciliação", async () => {
      const { service, audit } = setup(conciliado());
      await service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { description: "Nova", origemTipo: "EMPRESA", investidorId: null });
      await service.updateTransaction(COMPANY, ACCOUNT, TX_ID, { conciliado: false });
      const fields = audit.log.mock.calls.map(([call]) => call.after.campo);
      expect(fields).toEqual(["Descrição", "Pago por", "Conciliação"]);
    });
  });
});

describe("FinanceService.createTransaction (origem)", () => {
  it("rejeita valor zero e investidor de outra empresa", async () => {
    const { service } = setup();
    const input = { categoryId: "cat-despesa-2", amount: "0", date: "2026-10-26T00:00:00.000Z", status: "REALIZADO" as const };
    await expect(service.createTransaction(COMPANY, ACCOUNT, input, "user-1")).rejects.toThrow("maior que zero");
    await expect(
      service.createTransaction(COMPANY, ACCOUNT, { ...input, amount: "10", origemTipo: "INVESTIDOR", investidorId: "inv-x" }, "user-1"),
    ).rejects.toThrow("Investidor informado não existe nesta empresa");
  });
});
