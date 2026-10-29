import { Prisma } from "@prisma/client";
import {
  type CashFlowMonthDto,
  type PostAcquisitionStage,
  type PropertyStatementDto,
  type ProspectStatus,
  type StatementCardsDto,
  type StatementCategoryLineDto,
  type StatementGroupDto,
  type StatementMode,
  type StatementStatusFilter,
  type TransactionDto,
  type TransactionOrigemTipo,
  type TransactionStatus,
} from "@leilao-erp/types";
import { marginPercent, projectedResult, roiPercent } from "../dashboard/portfolio-metrics";
import { isReimbursementCategory, normalizeCategoryName, sumByOrigin } from "./transaction-rules";

const DAY_MS = 24 * 60 * 60 * 1000;
const ZERO = new Prisma.Decimal(0);
const dec = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value);
const money = (value: Prisma.Decimal) => value.toFixed(2);

export interface StatementProperty {
  status: ProspectStatus;
  etapa: PostAcquisitionStage | null;
  avaliacao: Prisma.Decimal | string | null;
  dataAquisicao: Date | null;
  canceladoEm: Date | null;
  motivoCancelamento: string | null;
}

/** Lançamento como vem do FinanceService (com categoria, investidor e flag de histórico). */
export interface StatementTransaction {
  id: string;
  financeAccountId: string;
  categoryId: string;
  category: { id: string; name: string; type: "RECEITA" | "DESPESA" };
  amount: Prisma.Decimal | string;
  date: Date;
  description: string | null;
  status: TransactionStatus;
  conciliado: boolean;
  conciliadoEm: Date | null;
  origemTipo: TransactionOrigemTipo | null;
  investidorId: string | null;
  investidor: { id: string; name: string } | null;
  hasHistory: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Despesa cujo nome contém "aquisição" ou "compra" (as categorias são nomes livres por empresa). */
export function isAquisicaoCategory(name: string): boolean {
  return /aquisi|compra/.test(normalizeCategoryName(name));
}

/** Despesa cujo nome contém "reforma". */
export function isReformaCategory(name: string): boolean {
  return normalizeCategoryName(name).includes("reforma");
}

export function statementMode(property: Pick<StatementProperty, "status" | "etapa">): StatementMode {
  if (property.status === "AQUISICAO_CANCELADA") return "CANCELADO";
  if (property.status === "VENDIDA" || property.etapa === "VENDIDO") return "VENDIDO";
  if (property.status === "ADQUIRIDA") return "ADQUIRIDO";
  return "OUTRO";
}

const percentOf = (part: Prisma.Decimal, whole: Prisma.Decimal) =>
  whole.greaterThan(0) ? part.dividedBy(whole).times(100).toFixed(4) : "0.0000";

function toTransactionDto(tx: StatementTransaction): TransactionDto {
  return {
    id: tx.id,
    financeAccountId: tx.financeAccountId,
    categoryId: tx.categoryId,
    category: tx.category,
    amount: dec(tx.amount).toFixed(2),
    date: tx.date.toISOString(),
    description: tx.description,
    status: tx.status,
    conciliado: tx.conciliado,
    conciliadoEm: tx.conciliadoEm ? tx.conciliadoEm.toISOString() : null,
    origemTipo: tx.origemTipo,
    investidorId: tx.investidorId,
    investidor: tx.investidor,
    hasHistory: tx.hasHistory,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}

function sumOf(transactions: StatementTransaction[], predicate: (tx: StatementTransaction) => boolean): Prisma.Decimal {
  return transactions.filter(predicate).reduce((sum, tx) => sum.plus(tx.amount), ZERO);
}

/**
 * Agrupa por categoria dentro de um tipo (despesa/receita) respeitando o filtro de status.
 * Cancelados só entram na soma quando o filtro é CANCELADO; nos demais casos ficam listados, sem somar.
 */
function buildGroups(
  transactions: StatementTransaction[],
  type: "RECEITA" | "DESPESA",
  filter: StatementStatusFilter,
  reformaOrcado: Prisma.Decimal,
): StatementGroupDto[] {
  const visible = transactions.filter(
    (tx) => tx.category.type === type && (filter === "TODOS" || tx.status === filter),
  );
  const counted = (tx: StatementTransaction) => filter === "CANCELADO" || tx.status !== "CANCELADO";

  const byCategory = new Map<string, StatementTransaction[]>();
  for (const tx of visible) byCategory.set(tx.categoryId, [...(byCategory.get(tx.categoryId) ?? []), tx]);

  const total = sumOf(visible, counted);
  const groups: StatementGroupDto[] = [...byCategory.values()].map((items) => {
    const subtotal = sumOf(items, counted);
    return {
      categoryId: items[0]!.categoryId,
      categoryName: items[0]!.category.name,
      count: items.length,
      subtotal: money(subtotal),
      percent: percentOf(subtotal, total),
      reforma: null,
      lancamentos: [...items]
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
        .map(toTransactionDto),
    };
  });
  groups.sort((a, b) => Number(b.subtotal) - Number(a.subtotal) || a.categoryName.localeCompare(b.categoryName, "pt-BR"));

  // Orçado x realizado: comparado ao total realizado em TODAS as categorias de reforma, e mostrado
  // no maior grupo de reforma (o orçamento do módulo Reforma é um só por imóvel).
  if (type === "DESPESA" && reformaOrcado.greaterThan(0)) {
    const realizado = sumOf(
      transactions,
      (tx) => tx.category.type === "DESPESA" && tx.status === "REALIZADO" && isReformaCategory(tx.category.name),
    );
    const target = groups.find((g) => isReformaCategory(g.categoryName));
    if (target) {
      target.reforma = {
        orcado: money(reformaOrcado),
        realizado: money(realizado),
        desvioPercent: realizado.minus(reformaOrcado).dividedBy(reformaOrcado).times(100).toFixed(4),
      };
    }
  }
  return groups;
}

export function buildStatement(input: {
  propertyId: string;
  property: StatementProperty;
  transactions: StatementTransaction[];
  /** Soma do valor previsto das tarefas do módulo Reforma (orçamento). */
  reformaOrcado: Prisma.Decimal | string;
  fluxoMensal: CashFlowMonthDto[];
  statusFilter: StatementStatusFilter;
  now: Date;
}): PropertyStatementDto {
  const { property, now, statusFilter } = input;
  const mode = statementMode(property);
  const reformaOrcado = dec(input.reformaOrcado);

  // Cancelado nunca entra em soma; só aparece listado (e filtrável).
  const live = input.transactions.filter((tx) => tx.status !== "CANCELADO");
  const despesasRealizadas = live.filter((tx) => tx.status === "REALIZADO" && tx.category.type === "DESPESA");
  const receitasRealizadas = live.filter((tx) => tx.status === "REALIZADO" && tx.category.type === "RECEITA");

  const capitalInvestido = sumOf(despesasRealizadas, () => true);
  const custosAteVenda = sumOf(live, (tx) => tx.status === "PREVISTO" && tx.category.type === "DESPESA");
  const custoAquisicao = sumOf(despesasRealizadas, (tx) => isAquisicaoCategory(tx.category.name));
  const receitas = sumOf(receitasRealizadas, () => true);
  const reembolsos = sumOf(receitasRealizadas, (tx) => isReimbursementCategory(tx.category.name));
  const resultadoRealizado = receitas.minus(capitalInvestido);

  const avaliacao = property.avaliacao !== null && dec(property.avaliacao).greaterThan(0) ? dec(property.avaliacao) : null;
  const resultadoProjetado = avaliacao ? projectedResult(avaliacao, capitalInvestido, custosAteVenda) : null;
  const margem = resultadoProjetado && avaliacao ? marginPercent(resultadoProjetado, avaliacao) : null;
  const roi = resultadoProjetado ? roiPercent(resultadoProjetado, capitalInvestido.plus(custosAteVenda)) : null;
  const margemRealizada = receitas.greaterThan(0) ? resultadoRealizado.dividedBy(receitas).times(100) : null;

  const cards: StatementCardsDto = {
    custoAquisicao: money(custoAquisicao),
    capitalInvestido: money(capitalInvestido),
    avaliacao: avaliacao ? money(avaliacao) : null,
    custosAteVenda: money(custosAteVenda),
    resultadoProjetado: resultadoProjetado ? money(resultadoProjetado) : null,
    margemPercentual: margem ? margem.toFixed(4) : null,
    roiPercentual: roi ? roi.toFixed(4) : null,
    receitasRealizadas: money(receitas),
    reembolsos: money(reembolsos),
    resultadoRealizado: money(resultadoRealizado),
    margemRealizadaPercentual: margemRealizada ? margemRealizada.toFixed(4) : null,
  };

  // Composição do custo: despesas realizadas por categoria, com % sobre o total.
  const byCategory = new Map<string, { name: string; total: Prisma.Decimal }>();
  for (const tx of despesasRealizadas) {
    const entry = byCategory.get(tx.categoryId) ?? { name: tx.category.name, total: ZERO };
    entry.total = entry.total.plus(tx.amount);
    byCategory.set(tx.categoryId, entry);
  }
  const composicao: StatementCategoryLineDto[] = [...byCategory.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.name,
      total: money(v.total),
      percent: percentOf(v.total, capitalInvestido),
    }))
    .sort((a, b) => Number(b.total) - Number(a.total));

  // Capital investido acumulado mês a mês (despesas realizadas, em UTC como o resto do sistema).
  const months = new Map<string, Prisma.Decimal>();
  for (const tx of despesasRealizadas) {
    const month = tx.date.toISOString().slice(0, 7);
    months.set(month, (months.get(month) ?? ZERO).plus(tx.amount));
  }
  let acumulado = ZERO;
  const capitalAcumulado = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, valorMes]) => {
      acumulado = acumulado.plus(valorMes);
      return { month, valorMes: money(valorMes), acumulado: money(acumulado) };
    });

  const origemCapital = sumByOrigin(
    despesasRealizadas.map((tx) => ({
      amount: tx.amount,
      origemTipo: tx.origemTipo,
      investidorId: tx.investidorId,
      investidorName: tx.investidor?.name ?? null,
    })),
  ).map((origin) => ({ ...origin, percent: percentOf(dec(origin.total), capitalInvestido) }));

  const currentMonth = now.toISOString().slice(0, 7);

  return {
    propertyId: input.propertyId,
    mode,
    statusFilter,
    header: {
      status: property.status,
      etapa: property.etapa,
      dataAquisicao: property.dataAquisicao ? property.dataAquisicao.toISOString() : null,
      diasEmCarteira: property.dataAquisicao
        ? Math.max(0, Math.floor((now.getTime() - property.dataAquisicao.getTime()) / DAY_MS))
        : null,
      canceladoEm: property.canceladoEm ? property.canceladoEm.toISOString() : null,
      motivoCancelamento: property.motivoCancelamento,
    },
    cards,
    composicao,
    capitalAcumulado,
    origemCapital,
    despesas: buildGroups(input.transactions, "DESPESA", statusFilter, reformaOrcado),
    receitas: buildGroups(input.transactions, "RECEITA", statusFilter, reformaOrcado),
    fluxoMensal: input.fluxoMensal.map((row) => ({ ...row, futuro: row.month > currentMonth })),
    projecaoVenda:
      mode === "ADQUIRIDO" && avaliacao && resultadoProjetado
        ? {
            avaliacao: money(avaliacao),
            custoIncorrido: money(capitalInvestido),
            custosAteVenda: money(custosAteVenda),
            resultadoProjetado: money(resultadoProjetado),
            margemPercentual: cards.margemPercentual,
            roiPercentual: cards.roiPercentual,
          }
        : null,
  };
}
