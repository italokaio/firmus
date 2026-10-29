import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PropertiesService, REALIZED_BLOCKS_DELETE_MESSAGE, CANCELLED_STATUS_LOCKED_MESSAGE } from "./properties.service";
import {
  ALREADY_CANCELLED_MESSAGE,
  ONLY_ACQUIRED_MESSAGE,
  PropertyCancellationService,
  REIMBURSEMENT_CATEGORY_NAME,
} from "./property-cancellation.service";

const COMPANY = "company-1";
const USER = "user-1";
const PROPERTY = "property-1";
const ACCOUNT = "account-1";
const BASE_INPUT = { motivo: "Desistência dos sócios", data: "2026-10-28T00:00:00.000Z" };

function setup(propertyStatus = "ADQUIRIDA", previstos: Array<{ id: string }> = [{ id: "p1" }, { id: "p2" }]) {
  const tx = {
    property: { updateMany: jest.fn(async () => ({ count: 1 })) },
    transaction: {
      findMany: jest.fn(async () => previstos),
      updateMany: jest.fn(async () => ({ count: previstos.length })),
      create: jest.fn(async () => ({ id: "reembolso-1" })),
    },
    financeCategory: {
      findFirst: jest.fn(async () => null as unknown),
      create: jest.fn(async () => ({ id: "cat-reembolso", type: "RECEITA" })),
    },
  };
  const prisma = {
    financeAccount: { findFirst: jest.fn(async () => ({ id: ACCOUNT })) },
    investor: { findFirst: jest.fn(async ({ where }) => (where.id === "inv-1" ? { id: "inv-1" } : null)) },
    transaction: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn) => fn(tx)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audit = { log: jest.fn(async (_p: Record<string, any>) => undefined) };
  const properties = {
    findById: jest.fn(async () => ({ id: PROPERTY, status: propertyStatus })),
  };
  const service = new PropertyCancellationService(prisma as never, audit as never, properties as never);
  return { service, prisma, tx, audit, properties };
}

describe("PropertyCancellationService.cancel", () => {
  it("C4: não cancela duas vezes (nem reativa)", async () => {
    const { service, prisma } = setup("AQUISICAO_CANCELADA");
    await expect(service.cancel(COMPANY, USER, PROPERTY, BASE_INPUT)).rejects.toThrow(ALREADY_CANCELLED_MESSAGE);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["EM_ANALISE", "REPROVADA", "VENDIDA"])("só cancela imóvel adquirido (%s é recusado)", async (status) => {
    const { service } = setup(status);
    await expect(service.cancel(COMPANY, USER, PROPERTY, BASE_INPUT)).rejects.toThrow(ONLY_ACQUIRED_MESSAGE);
  });

  it("C1/C2: grava status, data, autor e motivo, protegido contra cancelamento concorrente", async () => {
    const { service, tx } = setup();
    await service.cancel(COMPANY, USER, PROPERTY, BASE_INPUT);
    expect(tx.property.updateMany).toHaveBeenCalledWith({
      where: { id: PROPERTY, companyId: COMPANY, status: "ADQUIRIDA" },
      data: {
        status: "AQUISICAO_CANCELADA",
        canceladoEm: new Date(BASE_INPUT.data),
        canceladoPorId: USER,
        motivoCancelamento: BASE_INPUT.motivo,
      },
    });
  });

  it("falha se outro cancelamento venceu a corrida (count 0)", async () => {
    const { service, tx } = setup();
    tx.property.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.cancel(COMPANY, USER, PROPERTY, BASE_INPUT)).rejects.toThrow(ALREADY_CANCELLED_MESSAGE);
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("C5/C6: só os PREVISTO viram CANCELADO (com histórico); realizados não são tocados", async () => {
    const { service, tx, audit } = setup();
    const result = await service.cancel(COMPANY, USER, PROPERTY, BASE_INPUT);

    expect(tx.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { financeAccountId: ACCOUNT, status: "PREVISTO" } }),
    );
    expect(tx.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["p1", "p2"] } }, data: { status: "CANCELADO" } });
    expect(result.canceledTransactions).toBe(2);

    const history = audit.log.mock.calls.map(([c]) => c).filter((c) => c.entityType === "Transaction");
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      entityId: "p1",
      action: "UPDATE",
      before: { campo: "Status", valor: "Previsto" },
      after: { campo: "Status", valor: "Cancelado" },
    });
  });

  it("sem reembolso, não cria receita nem categoria", async () => {
    const { service, tx } = setup();
    const result = await service.cancel(COMPANY, USER, PROPERTY, BASE_INPUT);
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.financeCategory.create).not.toHaveBeenCalled();
    expect(result.reimbursementTransactionId).toBeNull();
  });

  it("C7: reembolso vira receita na categoria 'Reembolso de aquisição' (criada na 1ª vez)", async () => {
    const { service, tx } = setup();
    const result = await service.cancel(COMPANY, USER, PROPERTY, {
      ...BASE_INPUT,
      reembolso: { valor: "30000", data: "2026-11-10T00:00:00.000Z", status: "REALIZADO", origemTipo: "EMPRESA" },
    });
    expect(tx.financeCategory.create).toHaveBeenCalledWith({
      data: { companyId: COMPANY, name: REIMBURSEMENT_CATEGORY_NAME, type: "RECEITA" },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        financeAccountId: ACCOUNT,
        categoryId: "cat-reembolso",
        amount: "30000",
        status: "REALIZADO",
        origemTipo: "EMPRESA",
        investidorId: null,
        createdById: USER,
      }),
    });
    expect(result.reimbursementTransactionId).toBe("reembolso-1");
  });

  it("reaproveita a categoria de reembolso existente e recusa uma homônima de despesa", async () => {
    const { service, tx } = setup();
    tx.financeCategory.findFirst.mockResolvedValueOnce({ id: "cat-existente", type: "RECEITA" });
    await service.cancel(COMPANY, USER, PROPERTY, {
      ...BASE_INPUT,
      reembolso: { valor: "100", data: BASE_INPUT.data, status: "PREVISTO" },
    });
    expect(tx.financeCategory.create).not.toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoryId: "cat-existente", status: "PREVISTO" }),
    });

    const second = setup();
    second.tx.financeCategory.findFirst.mockResolvedValueOnce({ id: "x", type: "DESPESA" });
    await expect(
      second.service.cancel(COMPANY, USER, PROPERTY, {
        ...BASE_INPUT,
        reembolso: { valor: "100", data: BASE_INPUT.data, status: "REALIZADO" },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("valida que o investidor do reembolso existe na empresa", async () => {
    const { service, prisma } = setup();
    await expect(
      service.cancel(COMPANY, USER, PROPERTY, {
        ...BASE_INPUT,
        reembolso: { valor: "10", data: BASE_INPUT.data, status: "REALIZADO", origemTipo: "INVESTIDOR", investidorId: "inv-x" },
      }),
    ).rejects.toThrow("Investidor informado não existe nesta empresa");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("PropertyCancellationService.getImpact", () => {
  it("separa previstos (a cancelar) do resultado realizado (perda = receitas − despesas)", async () => {
    const { service, prisma } = setup();
    prisma.transaction.findMany.mockResolvedValueOnce([
      { amount: new Prisma.Decimal("38000"), status: "REALIZADO", category: { type: "DESPESA" } },
      { amount: new Prisma.Decimal("10560"), status: "REALIZADO", category: { type: "DESPESA" } },
      { amount: new Prisma.Decimal("8700"), status: "REALIZADO", category: { type: "DESPESA" } },
      { amount: new Prisma.Decimal("20000"), status: "REALIZADO", category: { type: "RECEITA" } },
      { amount: new Prisma.Decimal("5000"), status: "PREVISTO", category: { type: "DESPESA" } },
      { amount: new Prisma.Decimal("1500"), status: "PREVISTO", category: { type: "DESPESA" } },
    ] as never);
    expect(await service.getImpact(COMPANY, PROPERTY)).toEqual({
      previstosCount: 2,
      previstosTotal: "6500.00",
      realizadoReceitas: "20000.00",
      realizadoDespesas: "57260.00",
      resultadoRealizado: "-37260.00",
    });
  });
});

describe("PropertiesService (C4 e C9)", () => {
  function makeService(property: Record<string, unknown>, realizedAccounts: Array<{ propertyId: string }>) {
    const prisma = {
      property: {
        findFirst: jest.fn(async () => ({ photos: [], documents: [], tags: [], ...property })),
        update: jest.fn(),
        delete: jest.fn(async () => undefined),
      },
      financeAccount: { findMany: jest.fn(async () => realizedAccounts) },
      $transaction: jest.fn(async (fn) => fn({ property: { update: jest.fn(async () => ({ photos: [], ...property })) } })),
    };
    const storage = { createDownloadUrl: jest.fn(async () => "url") };
    const audit = { log: jest.fn(async () => undefined) };
    return { service: new PropertiesService(prisma as never, storage as never, audit as never), prisma };
  }

  it("C9: bloqueia a exclusão de imóvel com lançamento realizado", async () => {
    const { service, prisma } = makeService({ id: "p", status: "ADQUIRIDA" }, [{ propertyId: "p" }]);
    await expect(service.delete(COMPANY, "p")).rejects.toThrow(REALIZED_BLOCKS_DELETE_MESSAGE);
    expect(prisma.property.delete).not.toHaveBeenCalled();
  });

  it("C9: imóvel cancelado com realizados continua sem poder ser excluído", async () => {
    const { service } = makeService({ id: "p", status: "AQUISICAO_CANCELADA" }, [{ propertyId: "p" }]);
    await expect(service.delete(COMPANY, "p")).rejects.toThrow(REALIZED_BLOCKS_DELETE_MESSAGE);
  });

  it("permite excluir imóvel sem lançamentos realizados (só previstos ou nenhum)", async () => {
    const { service, prisma } = makeService({ id: "p", status: "EM_ANALISE" }, []);
    await service.delete(COMPANY, "p");
    expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: "p" } });
  });

  it("C4: depois de cancelada, o status não muda mais, mas outras edições passam", async () => {
    const { service } = makeService({ id: "p", status: "AQUISICAO_CANCELADA" }, []);
    await expect(service.update(COMPANY, "p", { status: "ADQUIRIDA" })).rejects.toThrow(CANCELLED_STATUS_LOCKED_MESSAGE);
    await expect(service.update(COMPANY, "p", { observacoes: "nota" })).resolves.toBeDefined();
  });
});
