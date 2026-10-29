import {
  buildAlerts,
  computePortfolio,
  marginPercent,
  projectedResult,
  roiPercent,
  type MetricProperty,
  type MetricTransaction,
} from "./portfolio-metrics";
import { Prisma } from "@prisma/client";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const EXTRAS = { saldoConsolidado: "-100.00", aportesRegistrados: "0.00" };

function property(id: string, overrides: Partial<MetricProperty> = {}): MetricProperty {
  return {
    id,
    origem: id,
    status: "ADQUIRIDA",
    prioridade: "MEDIA",
    avaliacao: "115000",
    etapa: null,
    dataAquisicao: null,
    ...overrides,
  };
}

function tx(propertyId: string | null, amount: string, overrides: Partial<MetricTransaction> = {}): MetricTransaction {
  return {
    propertyId,
    amount,
    status: "REALIZADO",
    date: new Date("2026-10-10T00:00:00.000Z"),
    categoryType: "DESPESA",
    origemTipo: null,
    investidorId: null,
    investidorName: null,
    ...overrides,
  };
}

/** Empresa Firmus em produção (28/10/2026): 3 adquiridos, 2 em análise, 1 reprovado. */
const FIRMUS_PROPERTIES = [
  property("H02", { origem: "Alvorada III - H 02 - Garden" }),
  property("F201", { origem: "Alvorada IV - F 201" }),
  property("B102", { origem: "Alvorada IV - B 102", avaliacao: "143000" }),
  property("I101", { status: "REPROVADA", avaliacao: "137000" }),
  property("A102", { status: "EM_ANALISE" }),
  property("M101", { status: "EM_ANALISE" }),
];
const FIRMUS_TRANSACTIONS: MetricTransaction[] = [
  tx("H02", "57800"),
  // F 201: R$ 57.260,00 = Aquisição 38.000 + Impostos 10.560 + Reforma 8.100 + Documentação 600
  tx("F201", "38000"),
  tx("F201", "10560"),
  tx("F201", "8100"),
  tx("F201", "600"),
  tx("B102", "64000.76"),
];

describe("fórmulas (P4)", () => {
  it("resultado projetado = avaliação − custo incorrido − custos até a venda (R4)", () => {
    const r = projectedResult(new Prisma.Decimal(115000), new Prisma.Decimal(57260), new Prisma.Decimal(5000));
    expect(r.toFixed(2)).toBe("52740.00");
  });

  it("margem = resultado ÷ avaliação; ROI = resultado ÷ (custo + previstos)", () => {
    expect(marginPercent(new Prisma.Decimal(50000), new Prisma.Decimal(100000))?.toFixed(2)).toBe("50.00");
    expect(roiPercent(new Prisma.Decimal(50000), new Prisma.Decimal(40000))?.toFixed(2)).toBe("125.00");
  });

  it("sem avaliação ou sem capital empregado, margem e ROI são nulos (nunca divisão por zero)", () => {
    expect(marginPercent(new Prisma.Decimal(10), new Prisma.Decimal(0))).toBeNull();
    expect(roiPercent(new Prisma.Decimal(10), new Prisma.Decimal(0))).toBeNull();
  });
});

describe("computePortfolio — dados reais da Firmus", () => {
  const dto = computePortfolio(FIRMUS_PROPERTIES, FIRMUS_TRANSACTIONS, EXTRAS, { now: NOW });

  it("F 201: custo incorrido de R$ 57.260,00 (R2)", () => {
    const f201 = dto.adquiridos.find((row) => row.id === "F201")!;
    expect(f201.custoIncorrido).toBe("57260.00");
    expect(f201.resultadoProjetado).toBe("57740.00");
  });

  it("conferência dos cards combinada na Fase 4", () => {
    expect(dto.carteira).toMatchObject({
      capitalInvestido: "179060.76",
      avaliacao: "373000.00",
      custoIncorrido: "179060.76",
      custosAteVenda: "0.00",
      resultadoProjetado: "193939.24",
      imoveisNaProjecao: 3,
      imoveisSemAvaliacao: 0,
    });
    // Percentuais saem com 4 casas e são arredondados uma só vez, na tela: 52,0% e 108,3%.
    expect(Number(dto.carteira.margemPercentual).toFixed(1)).toBe("52.0");
    expect(Number(dto.carteira.roiPercentual).toFixed(1)).toBe("108.3");
  });

  it("contagens: o card não confunde mais cadastrados com adquiridos", () => {
    expect(dto.counts).toEqual({
      cadastrados: 6,
      emAnalise: 2,
      adquiridos: 3,
      vendidos: 0,
      reprovados: 1,
      cancelados: 0,
    });
  });
});

describe("custos até a venda (R3) e lançamentos cancelados", () => {
  it("soma só despesas PREVISTO dos adquiridos na projeção", () => {
    const dto = computePortfolio(
      [property("A", { avaliacao: "100000" })],
      [tx("A", "40000"), tx("A", "7000", { status: "PREVISTO" }), tx("A", "999", { status: "PREVISTO", categoryType: "RECEITA" })],
      EXTRAS,
      { now: NOW },
    );
    expect(dto.carteira.custoIncorrido).toBe("40000.00");
    expect(dto.carteira.custosAteVenda).toBe("7000.00");
    expect(dto.carteira.resultadoProjetado).toBe("53000.00");
  });

  it("lançamentos CANCELADO não entram em nenhuma soma", () => {
    const dto = computePortfolio(
      [property("A")],
      [tx("A", "1000"), tx("A", "5000", { status: "CANCELADO" }), tx(null, "777", { status: "CANCELADO" })],
      EXTRAS,
      { now: NOW },
    );
    expect(dto.carteira.custoIncorrido).toBe("1000.00");
    expect(dto.carteira.custosAteVenda).toBe("0.00");
    expect(dto.caixa.despesasRealizadasMes).toBe("1000.00");
  });
});

describe("imóveis cancelados e reprovados (R6)", () => {
  const properties = [
    property("A"),
    property("CANC", { status: "AQUISICAO_CANCELADA", avaliacao: "200000" }),
    property("REPR", { status: "REPROVADA" }),
  ];
  const transactions = [
    tx("A", "1000"),
    tx("CANC", "50000"),
    tx("CANC", "20000", { categoryType: "RECEITA" }), // reembolso
  ];
  const dto = computePortfolio(properties, transactions, EXTRAS, { now: NOW });

  it("ficam fora do funil e da projeção; viram só contagem informativa", () => {
    expect(dto.counts).toMatchObject({ adquiridos: 1, cancelados: 1, reprovados: 1 });
    expect(dto.funnel.reduce((s, step) => s + step.count, 0) + dto.semEtapa.count).toBe(1);
    expect(dto.carteira.avaliacao).toBe("115000.00");
    expect(dto.carteira.imoveisNaProjecao).toBe(1);
    expect(dto.adquiridos.map((r) => r.id)).toEqual(["A"]);
  });

  it("mostram o resultado realizado (perda) do cancelado", () => {
    expect(dto.canceladosResultadoRealizado).toBe("-30000.00");
  });

  it("os lançamentos realizados do cancelado continuam no caixa", () => {
    expect(dto.caixa.despesasRealizadasMes).toBe("51000.00");
    expect(dto.caixa.receitasRealizadasMes).toBe("20000.00");
  });
});

describe("imóvel sem avaliação (R7)", () => {
  const properties = [
    property("COM", { avaliacao: "100000" }),
    property("NULA", { avaliacao: null }),
    property("ZERO", { avaliacao: "0" }),
  ];
  const transactions = [tx("COM", "10000"), tx("NULA", "20000"), tx("ZERO", "30000")];
  const dto = computePortfolio(properties, transactions, EXTRAS, { now: NOW });

  it("fica fora das somas de projeção e é sinalizado, nunca tratado como zero", () => {
    expect(dto.carteira).toMatchObject({
      avaliacao: "100000.00",
      custoIncorrido: "10000.00",
      resultadoProjetado: "90000.00",
      imoveisNaProjecao: 1,
      imoveisSemAvaliacao: 2,
    });
    const nula = dto.adquiridos.find((r) => r.id === "NULA")!;
    expect(nula).toMatchObject({ semAvaliacao: true, avaliacao: null, resultadoProjetado: null, margemPercentual: null });
  });

  it("o capital investido ainda conta o dinheiro que realmente saiu", () => {
    expect(dto.carteira.capitalInvestido).toBe("60000.00");
  });
});

describe("funil", () => {
  it("agrupa por status e por etapa pós-aquisição; sem etapa fica à parte", () => {
    const dto = computePortfolio(
      [
        property("N", { status: "NOVA_OPORTUNIDADE" }),
        property("E", { status: "EM_DUE_DILIGENCE" }),
        property("D", { etapa: "DESOCUPACAO_DOCUMENTACAO" }),
        property("R", { etapa: "REFORMA" }),
        property("S", { etapa: null }),
        property("V", { status: "VENDIDA" }),
      ],
      [tx("R", "300"), tx("S", "50"), tx("V", "700"), tx("N", "10")],
      EXTRAS,
      { now: NOW },
    );
    const byKey = Object.fromEntries(dto.funnel.map((s) => [s.key, s])) as Record<string, (typeof dto.funnel)[number]>;
    expect(byKey.EM_ANALISE).toMatchObject({ count: 2, capital: "10.00" });
    expect(byKey.DESOCUPACAO_DOCUMENTACAO!.count).toBe(1);
    expect(byKey.REFORMA).toMatchObject({ count: 1, capital: "300.00" });
    expect(byKey.A_VENDA!.count).toBe(0);
    expect(byKey.VENDIDO).toMatchObject({ count: 1, capital: "700.00" });
    expect(dto.semEtapa).toEqual({ count: 1, capital: "50.00", avaliacao: "115000.00" });
  });
});

describe("avaliação por etapa e lista de cancelados (relatório do portfólio)", () => {
  it("soma a avaliação Caixa de cada etapa, ignorando imóveis sem avaliação", () => {
    const dto = computePortfolio(
      [
        property("R1", { etapa: "REFORMA", avaliacao: "100000" }),
        property("R2", { etapa: "REFORMA", avaliacao: "50000" }),
        property("R3", { etapa: "REFORMA", avaliacao: null }),
        property("E1", { status: "EM_ANALISE", avaliacao: "70000" }),
      ],
      [],
      EXTRAS,
      { now: NOW },
    );
    const byKey = Object.fromEntries(dto.funnel.map((s) => [s.key, s]));
    expect(byKey.REFORMA).toMatchObject({ count: 3, avaliacao: "150000.00" });
    expect(byKey.EM_ANALISE).toMatchObject({ count: 1, avaliacao: "70000.00" });
  });

  it("lista cada aquisição cancelada com capital, reembolsos e resultado realizado (perda)", () => {
    const dto = computePortfolio(
      [property("CANC", { status: "AQUISICAO_CANCELADA", origem: "Alvorada X", canceladoEm: new Date("2026-11-01T00:00:00.000Z") })],
      [
        tx("CANC", "57800"),
        tx("CANC", "20000", { categoryType: "RECEITA", categoryName: "Reembolso de aquisição" }),
        tx("CANC", "500", { categoryType: "RECEITA", categoryName: "Venda de imóvel" }),
      ],
      EXTRAS,
      { now: NOW },
    );
    expect(dto.cancelados).toEqual([
      {
        id: "CANC",
        origem: "Alvorada X",
        canceladoEm: "2026-11-01T00:00:00.000Z",
        capitalInvestido: "57800.00",
        reembolsos: "20000.00",
        resultadoRealizado: "-37300.00",
      },
    ]);
  });
});

describe("caixa", () => {
  it("soma o mês escolhido em todas as contas da empresa (inclusive as sem imóvel)", () => {
    const dto = computePortfolio(
      [property("A")],
      [
        tx("A", "100", { date: new Date("2026-09-30T00:00:00.000Z") }),
        tx(null, "250", { date: new Date("2026-10-01T00:00:00.000Z") }),
        tx(null, "900", { categoryType: "RECEITA", date: new Date("2026-10-31T00:00:00.000Z") }),
        tx(null, "40", { date: new Date("2026-11-01T00:00:00.000Z") }),
      ],
      EXTRAS,
      { month: "2026-10", now: NOW },
    );
    expect(dto.month).toBe("2026-10");
    expect(dto.caixa.despesasRealizadasMes).toBe("250.00");
    expect(dto.caixa.receitasRealizadasMes).toBe("900.00");
  });

  it("saídas previstas dos próximos 90 dias: ignora receitas, passado e depois do prazo", () => {
    const plusDays = (d: number) => new Date(NOW.getTime() + d * 86400000);
    const dto = computePortfolio(
      [],
      [
        tx(null, "100", { status: "PREVISTO", date: plusDays(1) }),
        tx(null, "200", { status: "PREVISTO", date: plusDays(89) }),
        tx(null, "400", { status: "PREVISTO", date: plusDays(120) }),
        tx(null, "800", { status: "PREVISTO", date: plusDays(-5) }),
        tx(null, "1600", { status: "PREVISTO", categoryType: "RECEITA", date: plusDays(2) }),
      ],
      EXTRAS,
      { now: NOW },
    );
    expect(dto.caixa.saidasPrevistas90Dias).toBe("300.00");
  });

  it("usa o mês atual quando nenhum é informado e repassa saldo e aportes", () => {
    const dto = computePortfolio([], [], { saldoConsolidado: "10.00", aportesRegistrados: "5.00" }, { now: NOW });
    expect(dto.month).toBe("2026-10");
    expect(dto.caixa).toMatchObject({ saldoConsolidado: "10.00", aportesRegistrados: "5.00" });
  });
});

describe("origem do capital", () => {
  it("soma as despesas realizadas dos adquiridos por 'Pago por'; 'Não informado' aparece", () => {
    const dto = computePortfolio(
      [property("A"), property("EM", { status: "EM_ANALISE" })],
      [
        tx("A", "38000", { origemTipo: "INVESTIDOR", investidorId: "i1", investidorName: "Ítalo" }),
        tx("A", "10560", { origemTipo: "EMPRESA" }),
        tx("A", "8700"),
        tx("A", "1", { status: "PREVISTO" }), // previsto não é capital já investido
        tx("EM", "999"), // fora da carteira adquirida
      ],
      EXTRAS,
      { now: NOW },
    );
    expect(dto.origemCapital.map((o) => [o.label, o.total])).toEqual([
      ["Ítalo", "38000.00"],
      ["Caixa da empresa", "10560.00"],
      ["Não informado", "8700.00"],
    ]);
  });
});

describe("dias em carteira", () => {
  it("só calcula com a data da aquisição informada — nunca estima", () => {
    const dto = computePortfolio(
      [
        property("COM", { dataAquisicao: new Date("2026-10-18T12:00:00.000Z") }),
        property("SEM", { dataAquisicao: null }),
      ],
      [],
      EXTRAS,
      { now: NOW },
    );
    expect(dto.adquiridos.find((r) => r.id === "COM")!.diasEmCarteira).toBe(10);
    expect(dto.adquiridos.find((r) => r.id === "SEM")!.diasEmCarteira).toBeNull();
  });
});

describe("buildAlerts", () => {
  const base = {
    now: NOW,
    adquiridos: [],
    legalCasesAguardandoPagamento: [],
    legalEventsPendentes: [],
    renovationTasks: [],
    receivablesPendentes: [],
    lancamentosSemOrigem: [],
    previstosVencidos: 0,
  };

  it("sem dado real, não há alerta", () => {
    expect(buildAlerts(base)).toEqual([]);
  });

  it("gera só os alertas que têm dado, com singular/plural e imóveis envolvidos", () => {
    const alerts = buildAlerts({
      ...base,
      adquiridos: [
        { id: "A", origem: "A", etapa: null, semAvaliacao: false },
        { id: "B", origem: "B", etapa: "REFORMA", semAvaliacao: true },
      ],
      legalCasesAguardandoPagamento: [{ propertyId: "A" }, { propertyId: "B" }, { propertyId: "C" }],
      legalEventsPendentes: [
        { propertyId: "A", dueDate: new Date("2026-10-01T00:00:00.000Z") },
        { propertyId: "B", dueDate: new Date("2026-10-30T00:00:00.000Z") },
        { propertyId: "C", dueDate: new Date("2026-12-30T00:00:00.000Z") },
      ],
      renovationTasks: [
        { propertyId: "A", dueDate: new Date("2026-10-01T00:00:00.000Z"), percentualConcluido: 40, valorPrevisto: "1000", valorRealizado: "1500" },
        { propertyId: "A", dueDate: null, percentualConcluido: 0, valorPrevisto: "0", valorRealizado: "0" },
      ],
      lancamentosSemOrigem: [{ propertyId: "A" }, { propertyId: "A" }],
    });
    const byId = Object.fromEntries(alerts.map((a) => [a.id, a]));
    expect(byId["legal-payment"]).toMatchObject({ count: 3, message: "3 processos jurídicos aguardando pagamento" });
    expect(byId["legal-overdue"]).toMatchObject({ tone: "negative", count: 1, propertyIds: ["A"] });
    expect(byId["legal-soon"]).toMatchObject({ tone: "forecast", count: 1, propertyIds: ["B"] });
    expect(byId["renovation-late"]).toMatchObject({ count: 1 });
    expect(byId["renovation-budget"]).toMatchObject({ count: 1, message: "1 imóvel com reforma acima do orçamento" });
    expect(byId["sem-etapa"]).toMatchObject({ count: 1, propertyIds: ["A"] });
    expect(byId["sem-avaliacao"]).toMatchObject({ count: 1, propertyIds: ["B"] });
    expect(byId["sem-origem"]).toMatchObject({ count: 2, propertyIds: ["A"] });
    expect(byId["receivables-late"]).toBeUndefined();
    expect(byId["previstos-overdue"]).toBeUndefined();
  });
});
