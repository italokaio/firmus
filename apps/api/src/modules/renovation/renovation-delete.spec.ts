import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RenovationService, TASK_WITH_REALIZED_VALUE_MESSAGE } from "./renovation.service";

const COMPANY = "company-1";
const PROPERTY = "property-1";

function setup(task: Record<string, unknown> | null, siblings: Array<{ id: string }> = []) {
  const tx = {
    renovationTask: {
      delete: jest.fn(async () => undefined),
      findMany: jest.fn(async () => siblings),
      update: jest.fn(async () => undefined),
    },
  };
  const prisma = {
    property: { findFirst: jest.fn(async () => ({ id: PROPERTY })) },
    renovationTask: { findFirst: jest.fn(async () => task) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audit = { log: jest.fn(async (_p: Record<string, any>) => undefined) };
  const service = new RenovationService(prisma as never, {} as never, audit as never);
  return { service, prisma, tx, audit };
}

const TASK = {
  id: "t1",
  title: "Pintura",
  stage: "EXECUCAO",
  valorPrevisto: "1500.00",
  valorRealizado: "0",
  media: [],
};

describe("RenovationService.deleteTask", () => {
  it("exclui o cartão, renumera a coluna e registra na auditoria", async () => {
    const { service, tx, audit } = setup(TASK, [{ id: "a" }, { id: "b" }]);
    await service.deleteTask(COMPANY, PROPERTY, "t1");
    expect(tx.renovationTask.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(tx.renovationTask.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { order: 0 } });
    expect(tx.renovationTask.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { order: 1 } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "RenovationTask", entityId: "t1", action: "DELETE" }),
    );
  });

  it("bloqueia quando há valor realizado (o gasto sumiria do DRE)", async () => {
    const { service, prisma } = setup({ ...TASK, valorRealizado: "250.50" });
    await expect(service.deleteTask(COMPANY, PROPERTY, "t1")).rejects.toThrow(TASK_WITH_REALIZED_VALUE_MESSAGE);
    await expect(service.deleteTask(COMPANY, PROPERTY, "t1")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("cartão inexistente (ou de outro imóvel) dá 404 e não apaga nada", async () => {
    const { service, prisma } = setup(null);
    await expect(service.deleteTask(COMPANY, PROPERTY, "x")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
