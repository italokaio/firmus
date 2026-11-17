import { NotFoundException } from "@nestjs/common";
import { PropertiesService } from "./properties.service";

const COMPANY = "company-1";
const PROPERTY = "property-1";

function setup(document: Record<string, unknown> | null, next: { id: string } | null) {
  const tx = {
    propertyDocument: {
      findFirst: jest.fn(async () => next),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    },
  };
  const prisma = {
    property: { findFirst: jest.fn(async () => ({ id: PROPERTY })) },
    propertyDocument: { findFirst: jest.fn(async () => document) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audit = { log: jest.fn(async (_p: Record<string, any>) => undefined) };
  const service = new PropertiesService(prisma as never, {} as never, audit as never);
  return { service, prisma, tx, audit };
}

describe("PropertiesService.deleteDocument", () => {
  it("apaga a versão e registra na auditoria", async () => {
    const { service, tx, audit } = setup({ id: "d1", name: "Proposta.pdf", version: 1, previousVersionId: null }, null);
    await service.deleteDocument(COMPANY, PROPERTY, "d1");
    expect(tx.propertyDocument.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    expect(tx.propertyDocument.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "PropertyDocument", entityId: "d1", action: "DELETE" }),
    );
  });

  it("apagando uma versão do meio, a seguinte é religada à anterior", async () => {
    const { service, tx } = setup({ id: "d2", name: "Laudo.pdf", version: 2, previousVersionId: "d1" }, { id: "d3" });
    await service.deleteDocument(COMPANY, PROPERTY, "d2");
    expect(tx.propertyDocument.update).toHaveBeenNthCalledWith(1, {
      where: { id: "d3" },
      data: { previousVersionId: null },
    });
    expect(tx.propertyDocument.update).toHaveBeenNthCalledWith(2, {
      where: { id: "d3" },
      data: { previousVersionId: "d1" },
    });
  });

  it("documento inexistente dá 404 e não apaga nada", async () => {
    const { service, prisma } = setup(null, null);
    await expect(service.deleteDocument(COMPANY, PROPERTY, "x")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
