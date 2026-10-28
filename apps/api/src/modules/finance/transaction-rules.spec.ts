import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createTransactionSchema, updateTransactionSchema } from "@leilao-erp/types";
import {
  CONCILIADO_LOCK_MESSAGE,
  assertConciliadoEditable,
  assertPositiveAmount,
  auditLogToHistoryEntries,
  diffTransaction,
  sumByOrigin,
  type TransactionSnapshot,
} from "./transaction-rules";

const base: TransactionSnapshot = {
  categoryId: "cat-1",
  categoryName: "Aquisição",
  amount: "57800.00",
  date: new Date("2026-10-26T00:00:00.000Z"),
  description: "Boleto",
  status: "REALIZADO",
  conciliado: false,
  origemTipo: null,
  investidorId: null,
  investidorName: null,
};

describe("diffTransaction", () => {
  it("não reporta nada quando os valores são equivalentes", () => {
    expect(diffTransaction(base, { ...base, amount: new Prisma.Decimal("57800") })).toEqual([]);
    expect(diffTransaction({ ...base, description: null }, { ...base, description: null })).toEqual([]);
  });

  it("gera uma entrada por campo alterado, com valores legíveis", () => {
    const changes = diffTransaction(base, {
      ...base,
      categoryId: "cat-2",
      categoryName: "Impostos",
      amount: "60000.00",
      date: new Date("2026-10-27T00:00:00.000Z"),
      description: "Boleto corrigido",
      status: "PREVISTO",
    });
    expect(changes.map((c) => c.field)).toEqual(["Categoria", "Valor", "Data", "Descrição", "Status"]);
    expect(changes.find((c) => c.field === "Data")).toMatchObject({ before: "26/10/2026", after: "27/10/2026" });
    expect(changes.find((c) => c.field === "Status")).toMatchObject({ before: "Realizado", after: "Previsto" });
  });

  it("registra a mudança de 'Pago por' (vazio → investidor → empresa)", () => {
    const toInvestor = { ...base, origemTipo: "INVESTIDOR" as const, investidorId: "inv-1", investidorName: "Ítalo" };
    expect(diffTransaction(base, toInvestor)).toEqual([
      { field: "Pago por", before: "Não informado", after: "Ítalo" },
    ]);
    const toCompany = { ...base, origemTipo: "EMPRESA" as const };
    expect(diffTransaction(toInvestor, toCompany)).toEqual([
      { field: "Pago por", before: "Ítalo", after: "Caixa da empresa" },
    ]);
  });
});

describe("assertConciliadoEditable (P6)", () => {
  const conciliado = { ...base, conciliado: true };

  it("permite descrição, categoria e 'Pago por' em lançamento conciliado", () => {
    expect(() =>
      assertConciliadoEditable(conciliado, {
        ...conciliado,
        description: "Nova",
        categoryId: "cat-2",
        categoryName: "Impostos",
        origemTipo: "EMPRESA",
      }),
    ).not.toThrow();
  });

  it.each([
    ["valor", { amount: "1.00" }],
    ["data", { date: new Date("2026-01-01T00:00:00.000Z") }],
    ["status", { status: "PREVISTO" as const }],
  ])("bloqueia alteração de %s em lançamento conciliado", (_name, patch) => {
    expect(() => assertConciliadoEditable(conciliado, { ...conciliado, ...patch })).toThrow(
      new BadRequestException(CONCILIADO_LOCK_MESSAGE),
    );
  });

  it("não bloqueia quando nada travado muda, nem lançamentos não conciliados", () => {
    expect(() => assertConciliadoEditable(conciliado, { ...conciliado })).not.toThrow();
    expect(() => assertConciliadoEditable(base, { ...base, amount: "1.00" })).not.toThrow();
  });

  it("não permite editar valor junto com o desfazer da conciliação", () => {
    expect(() => assertConciliadoEditable(conciliado, { ...conciliado, conciliado: false, amount: "1.00" })).toThrow();
  });
});

describe("assertPositiveAmount", () => {
  it("rejeita zero e aceita valores positivos", () => {
    expect(() => assertPositiveAmount("0")).toThrow(BadRequestException);
    expect(() => assertPositiveAmount("0.00")).toThrow(BadRequestException);
    expect(() => assertPositiveAmount("0.01")).not.toThrow();
  });
});

describe("sumByOrigin", () => {
  it("soma por investidor, empresa e não informado", () => {
    const totals = sumByOrigin([
      { amount: "38000.00", origemTipo: "INVESTIDOR", investidorId: "inv-1", investidorName: "Ítalo" },
      { amount: "10560.00", origemTipo: "EMPRESA", investidorId: null, investidorName: null },
      { amount: "8100.00", origemTipo: null, investidorId: null, investidorName: null },
      { amount: "600.00", origemTipo: "INVESTIDOR", investidorId: "inv-1", investidorName: "Ítalo" },
    ]);
    expect(totals).toEqual([
      { key: "inv-1", label: "Ítalo", total: "38600.00", count: 2 },
      { key: "EMPRESA", label: "Caixa da empresa", total: "10560.00", count: 1 },
      { key: "NAO_INFORMADO", label: "Não informado", total: "8100.00", count: 1 },
    ]);
    expect(totals.reduce((s, t) => s + Number(t.total), 0)).toBe(57260);
  });

  it("devolve lista vazia sem lançamentos", () => {
    expect(sumByOrigin([])).toEqual([]);
  });
});

describe("auditLogToHistoryEntries", () => {
  const meta = { id: "log-1", createdAt: new Date("2026-10-28T12:00:00.000Z"), user: { name: "Ítalo Lima" } };

  it("lê o formato novo { campo, valor }", () => {
    expect(
      auditLogToHistoryEntries({
        ...meta,
        before: { campo: "Valor", valor: "R$ 1,00" },
        after: { campo: "Valor", valor: "R$ 2,00" },
      }),
    ).toEqual([
      {
        id: "log-1",
        createdAt: "2026-10-28T12:00:00.000Z",
        userName: "Ítalo Lima",
        field: "Valor",
        before: "R$ 1,00",
        after: "R$ 2,00",
      },
    ]);
  });

  it("expande registros antigos { status, conciliado }", () => {
    const entries = auditLogToHistoryEntries({
      ...meta,
      before: { status: "PREVISTO", conciliado: false },
      after: { status: "REALIZADO", conciliado: true },
    });
    expect(entries.map((e) => [e.field, e.before, e.after])).toEqual([
      ["Status", "Previsto", "Realizado"],
      ["Conciliação", "Não conciliado", "Conciliado"],
    ]);
  });

  it("ignora registros antigos sem mudança real", () => {
    expect(
      auditLogToHistoryEntries({
        ...meta,
        before: { status: "PREVISTO", conciliado: false },
        after: { status: "PREVISTO", conciliado: false },
      }),
    ).toEqual([]);
  });
});

describe("schemas de origem ('Pago por')", () => {
  const tx = { categoryId: "5e4a582f-c4b8-403a-a98c-3f6250337db1", amount: "10", date: "2026-10-26T00:00:00.000Z" };
  const investor = "554c697c-5c99-4aa4-9778-0d12113725ab";

  it("origem é opcional (lançamentos sem 'Pago por')", () => {
    expect(createTransactionSchema.safeParse(tx).success).toBe(true);
  });

  it("INVESTIDOR exige investidorId; EMPRESA não aceita investidorId", () => {
    expect(createTransactionSchema.safeParse({ ...tx, origemTipo: "INVESTIDOR" }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...tx, origemTipo: "INVESTIDOR", investidorId: investor }).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...tx, origemTipo: "EMPRESA", investidorId: investor }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...tx, origemTipo: "EMPRESA" }).success).toBe(true);
  });

  it("na edição, investidorId sozinho é rejeitado e null limpa a origem", () => {
    expect(updateTransactionSchema.safeParse({ investidorId: investor }).success).toBe(false);
    expect(updateTransactionSchema.safeParse({ origemTipo: null, investidorId: null }).success).toBe(true);
    expect(updateTransactionSchema.safeParse({ description: "x" }).success).toBe(true);
  });
});
