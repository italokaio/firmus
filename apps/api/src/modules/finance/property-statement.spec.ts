import { Prisma } from "@prisma/client";
import { FinanceService } from "./finance.service";
import {
  buildStatement,
  isAquisicaoCategory,
  isReformaCategory,
  statementMode,
  type StatementProperty,
  type StatementTransaction,
} from "./property-statement";

const NOW = new Date("2026-10-29T12:00:00.000Z");
const CATS = {
  aquisicao: { id: "c-aq", name: "Aquisição de imóvel", type: "DESPESA" as const },
  impostos: { id: "c-imp", name: "Impostos ", type: "DESPESA" as const },
  reforma: { id: "c-ref", name: "Reforma de imóvel", type: "DESPESA" as const },
  docs: { id: "c-doc", name: "Documentação de imóvel", type: "DESPESA" as const },
  venda: { id: "c-ven", name: "Venda de imóvel", type: "RECEITA" as const },
  reembolso: { id: "c-reemb", name: "Reembolso de aquisição", type: "RECEITA" as const },
};

let counter = 0;
function tx(
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
    createdAt: new Date(`2026-10-01T00:00:0${counter % 10}.000Z`),
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

/**
 * Alvorada IV · F 201 (produção): despesas realizadas de R$ 57.260,00.
 * Aquisição 38.000 · Impostos 10.560 · Reforma 8.100 · Documentação 600.
 * Por mês: fev 45.200 · mar 600 · jun 6.650 · jul 1.450 · out 3.360.
 */
const F201 = [
  tx(CATS.aquisicao, "38000", "2026-02-03"),
  tx(CATS.impostos, "7200", "2026-02-10"), // fev = 45.200
  tx(CATS.docs, "600", "2026-03-05"), // mar = 600
  tx(CATS.impostos, "3360", "2026-06-12"),
  tx(CATS.reforma, "3290", "2026-06-20"), // jun = 6.650
  tx(CATS.reforma, "1450", "2026-07-15"), // jul = 1.450
  tx(CATS.reforma, "3360", "2026-10-05"), // out = 3.360
];

const build = (
  transactions: StatementTransaction[],
  property: StatementProperty = ACQUIRED,
  extra: Partial<Parameters<typeof buildStatement>[0]> = {},
) =>
  buildStatement({
    propertyId: "p1",
    property,
    transactions,
    reformaOrcado: "0",
    fluxoMensal: [],
    statusFilter: "TODOS",
    now: NOW,
    ...extra,
  });

describe("identificação de categorias por nome", () => {
  it("reconhece Aquisição/Compra e Reforma ignorando acento, caixa e espaços", () => {
    expect(isAquisicaoCategory("Aquisição de imóvel")).toBe(true);
    expect(isAquisicaoCategory("  COMPRA imóvel ")).toBe(true);
    expect(isAquisicaoCategory("Impostos")).toBe(false);
    expect(isReformaCategory("Reforma de imóvel")).toBe(true);
    expect(isReformaCategory("REFORMA")).toBe(true);
    expect(isReformaCategory("Documentação")).toBe(false);
  });
});

describe("F 201 — conferência com dados reais", () => {
  const dto = build(F201);

  it("capital investido de R$ 57.260,00 (R2) e custo de aquisição de R$ 38.000,00", () => {
    expect(dto.cards.capitalInvestido).toBe("57260.00");
    expect(dto.cards.custoAquisicao).toBe("38000.00");
  });

  it("composição: quatro categorias com 66,4% · 18,4% · 14,1% · 1,0%", () => {
    expect(dto.composicao.map((c) => [c.categoryName.trim(), c.total, Number(c.percent).toFixed(1)])).toEqual([
      ["Aquisição de imóvel", "38000.00", "66.4"],
      ["Impostos", "10560.00", "18.4"],
      ["Reforma de imóvel", "8100.00", "14.1"],
      ["Documentação de imóvel", "600.00", "1.0"],
    ]);
  });

  it("capital acumulado mês a mês fecha em R$ 57.260,00", () => {
    expect(dto.capitalAcumulado).toEqual([
      { month: "2026-02", valorMes: "45200.00", acumulado: "45200.00" },
      { month: "2026-03", valorMes: "600.00", acumulado: "45800.00" },
      { month: "2026-06", valorMes: "6650.00", acumulado: "52450.00" },
      { month: "2026-07", valorMes: "1450.00", acumulado: "53900.00" },
      { month: "2026-10", valorMes: "3360.00", acumulado: "57260.00" },
    ]);
  });

  it("projeção: avaliação − custo incorrido − custos até a venda", () => {
    expect(dto.mode).toBe("ADQUIRIDO");
    expect(dto.projecaoVenda).toMatchObject({
      avaliacao: "115000.00",
      custoIncorrido: "57260.00",
      custosAteVenda: "0.00",
      resultadoProjetado: "57740.00",
    });
  });

  it("não existe mais 'lucro líquido' negativo em imóvel não vendido: o resultado realizado só aparece no modo vendido/cancelado", () => {
    expect(dto.mode).not.toBe("VENDIDO");
    expect(dto.cards.resultadoRealizado).toBe("-57260.00"); // dado bruto; a tela só o usa em vendido/cancelado
  });
});

describe("H 02 — um lançamento", () => {
  it("R$ 57.800,00 de aquisição em 26/10/2026", () => {
    const dto = build([tx(CATS.aquisicao, "57800", "2026-10-26")]);
    expect(dto.cards.capitalInvestido).toBe("57800.00");
    expect(dto.capitalAcumulado).toEqual([{ month: "2026-10", valorMes: "57800.00", acumulado: "57800.00" }]);
  });
});

describe("custos até a venda (R3) e cancelados", () => {
  it("previstos entram em custos até a venda e no fluxo, mas não no capital", () => {
    const dto = build([tx(CATS.aquisicao, "40000", "2026-02-03"), tx(CATS.docs, "5000", "2026-12-01", { status: "PREVISTO" })]);
    expect(dto.cards.capitalInvestido).toBe("40000.00");
    expect(dto.cards.custosAteVenda).toBe("5000.00");
    expect(dto.cards.resultadoProjetado).toBe("70000.00");
    expect(Number(dto.cards.margemPercentual).toFixed(2)).toBe("60.87");
    expect(Number(dto.cards.roiPercentual).toFixed(2)).toBe("155.56");
  });

  it("cancelados não entram em nenhuma soma, mas continuam listados", () => {
    const dto = build([
      tx(CATS.aquisicao, "1000", "2026-02-03"),
      tx(CATS.docs, "9999", "2026-12-01", { status: "CANCELADO" }),
    ]);
    expect(dto.cards.custosAteVenda).toBe("0.00");
    expect(dto.cards.capitalInvestido).toBe("1000.00");
    const docs = dto.despesas.find((g) => g.categoryId === CATS.docs.id)!;
    expect(docs.count).toBe(1);
    expect(docs.subtotal).toBe("0.00"); // filtro "Todos" lista, mas não soma cancelado
  });
});

describe("filtro de status da lista agrupada", () => {
  const items = [
    tx(CATS.aquisicao, "1000", "2026-02-03"),
    tx(CATS.aquisicao, "300", "2026-12-03", { status: "PREVISTO" }),
    tx(CATS.docs, "700", "2026-12-05", { status: "PREVISTO" }),
    tx(CATS.docs, "50", "2026-04-05", { status: "CANCELADO" }),
  ];

  it.each([
    ["REALIZADO", ["Aquisição de imóvel:1000.00"], "100.00"],
    ["PREVISTO", ["Documentação de imóvel:700.00", "Aquisição de imóvel:300.00"], "70.00"],
    ["CANCELADO", ["Documentação de imóvel:50.00"], "100.00"],
  ])("%s", (filter, expected, firstPercent) => {
    const dto = build(items, ACQUIRED, { statusFilter: filter as "REALIZADO" | "PREVISTO" | "CANCELADO" });
    expect(dto.despesas.map((g) => `${g.categoryName}:${g.subtotal}`)).toEqual(expected);
    expect(Number(dto.despesas[0]!.percent).toFixed(2)).toBe(firstPercent);
  });

  it("TODOS soma realizado + previsto (sem cancelado) e lista tudo", () => {
    const dto = build(items, ACQUIRED, { statusFilter: "TODOS" });
    expect(dto.despesas.map((g) => [g.categoryName, g.subtotal, g.count])).toEqual([
      ["Aquisição de imóvel", "1300.00", 2],
      ["Documentação de imóvel", "700.00", 2],
    ]);
  });

  it("o filtro não altera os cards", () => {
    expect(build(items, ACQUIRED, { statusFilter: "CANCELADO" }).cards).toEqual(build(items).cards);
  });
});

describe("orçado x realizado em reforma", () => {
  it("só aparece com orçamento; compara com TODAS as categorias de reforma realizadas", () => {
    const items = [tx(CATS.reforma, "8100", "2026-06-20"), tx(CATS.aquisicao, "1000", "2026-02-03")];
    expect(build(items).despesas.every((g) => g.reforma === null)).toBe(true);

    const withBudget = build(items, ACQUIRED, { reformaOrcado: "6000" });
    const reforma = withBudget.despesas.find((g) => g.categoryId === CATS.reforma.id)!;
    expect(reforma.reforma).toEqual({ orcado: "6000.00", realizado: "8100.00", desvioPercent: "35.0000" });
    expect(withBudget.despesas.find((g) => g.categoryId === CATS.aquisicao.id)!.reforma).toBeNull();
  });
});

describe("modos (vendido, cancelado, em análise)", () => {
  it("rótulos por modo", () => {
    expect(statementMode({ status: "ADQUIRIDA", etapa: null })).toBe("ADQUIRIDO");
    expect(statementMode({ status: "VENDIDA", etapa: null })).toBe("VENDIDO");
    expect(statementMode({ status: "ADQUIRIDA", etapa: "VENDIDO" })).toBe("VENDIDO");
    expect(statementMode({ status: "AQUISICAO_CANCELADA", etapa: "VENDIDO" })).toBe("CANCELADO");
    expect(statementMode({ status: "EM_ANALISE", etapa: null })).toBe("OUTRO");
  });

  it("vendido: resultado realizado e margem sobre as receitas; sem projeção", () => {
    const dto = build(
      [tx(CATS.aquisicao, "60000", "2026-02-03"), tx(CATS.venda, "100000", "2026-09-10")],
      { ...ACQUIRED, status: "VENDIDA" },
    );
    expect(dto.mode).toBe("VENDIDO");
    expect(dto.cards.receitasRealizadas).toBe("100000.00");
    expect(dto.cards.resultadoRealizado).toBe("40000.00");
    expect(Number(dto.cards.margemRealizadaPercentual).toFixed(2)).toBe("40.00");
    expect(dto.projecaoVenda).toBeNull();
  });

  it("cancelado: capital, reembolsos e perda realizada; sem projeção", () => {
    const dto = build(
      [
        tx(CATS.aquisicao, "57800", "2026-10-26"),
        tx(CATS.reembolso, "20000", "2026-11-10"),
        tx(CATS.docs, "900", "2026-12-01", { status: "CANCELADO" }),
      ],
      { ...ACQUIRED, status: "AQUISICAO_CANCELADA", canceladoEm: new Date("2026-11-01T00:00:00.000Z"), motivoCancelamento: "Desistência" },
    );
    expect(dto.mode).toBe("CANCELADO");
    expect(dto.cards).toMatchObject({ capitalInvestido: "57800.00", reembolsos: "20000.00", resultadoRealizado: "-37800.00" });
    expect(dto.projecaoVenda).toBeNull();
    expect(dto.header).toMatchObject({ motivoCancelamento: "Desistência", canceladoEm: "2026-11-01T00:00:00.000Z" });
  });

  it("em análise: sem projeção; sem avaliação, o resultado projetado é nulo (nunca zero)", () => {
    expect(build([tx(CATS.docs, "100", "2026-02-03")], { ...ACQUIRED, status: "EM_ANALISE" }).projecaoVenda).toBeNull();
    const semAval = build([tx(CATS.docs, "100", "2026-02-03")], { ...ACQUIRED, avaliacao: null });
    expect(semAval.cards.avaliacao).toBeNull();
    expect(semAval.cards.resultadoProjetado).toBeNull();
    expect(semAval.projecaoVenda).toBeNull();
  });
});

describe("origem do capital e cabeçalho", () => {
  it("soma por 'Pago por' com % sobre o capital investido", () => {
    const dto = build([
      tx(CATS.aquisicao, "38000", "2026-02-03", { origemTipo: "INVESTIDOR", investidorId: "i1", investidor: { id: "i1", name: "Ítalo" } }),
      tx(CATS.impostos, "19260", "2026-02-10"),
    ]);
    expect(dto.origemCapital.map((o) => [o.label, o.total, Number(o.percent).toFixed(1)])).toEqual([
      ["Ítalo", "38000.00", "66.4"],
      ["Não informado", "19260.00", "33.6"],
    ]);
  });

  it("dias em carteira só com data da aquisição", () => {
    expect(build([], { ...ACQUIRED, dataAquisicao: new Date("2026-10-19T12:00:00.000Z") }).header.diasEmCarteira).toBe(10);
    expect(build([]).header.diasEmCarteira).toBeNull();
  });

  it("marca meses futuros no fluxo", () => {
    const dto = build([], ACQUIRED, {
      fluxoMensal: [
        { month: "2026-10", previstoEntradas: "0.00", previstoSaidas: "0.00", realizadoEntradas: "0.00", realizadoSaidas: "10.00", saldoAcumulado: "-10.00" },
        { month: "2026-12", previstoEntradas: "0.00", previstoSaidas: "5.00", realizadoEntradas: "0.00", realizadoSaidas: "0.00", saldoAcumulado: "-10.00" },
      ],
    });
    expect(dto.fluxoMensal.map((m) => [m.month, m.futuro])).toEqual([["2026-10", false], ["2026-12", true]]);
  });
});

describe("fluxo mensal do imóvel (F 201)", () => {
  it("reproduz os meses reais, sem somar cancelados", async () => {
    const rows = [
      ...F201.map((t) => ({ ...t, category: t.category })),
      tx(CATS.docs, "777", "2026-10-20", { status: "CANCELADO" }),
    ];
    const prisma = {
      property: { findFirst: jest.fn(async () => ({ id: "p1", origem: "F 201" })) },
      financeAccount: { findUnique: jest.fn(async () => ({ id: "acc", saldoInicial: new Prisma.Decimal(0) })) },
      transaction: { findMany: jest.fn(async () => rows) },
    };
    const service = new FinanceService(prisma as never, { log: jest.fn() } as never);
    const flow = await service.getCashflow("company", "p1");
    expect(flow.map((m) => [m.month, m.realizadoSaidas])).toEqual([
      ["2026-02", "45200.00"],
      ["2026-03", "600.00"],
      ["2026-06", "6650.00"],
      ["2026-07", "1450.00"],
      ["2026-10", "3360.00"],
    ]);
    expect(flow[flow.length - 1]!.saldoAcumulado).toBe("-57260.00");
  });
});
