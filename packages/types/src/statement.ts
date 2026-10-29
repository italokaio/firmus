import { z } from "zod";
import type { CashFlowMonthDto, OriginTotalDto, TransactionDto } from "./finance";
import type { PostAcquisitionStage, ProspectStatus } from "./properties";

/** Filtro da lista agrupada por categoria (não altera os cards, que são sempre calculados sobre o realizado/previsto). */
export const STATEMENT_STATUS_FILTERS = ["TODOS", "REALIZADO", "PREVISTO", "CANCELADO"] as const;
export type StatementStatusFilter = (typeof STATEMENT_STATUS_FILTERS)[number];

export const statementQuerySchema = z.object({
  status: z.enum(STATEMENT_STATUS_FILTERS).default("TODOS"),
});
export type StatementQueryInput = z.infer<typeof statementQuerySchema>;

/**
 * Como a DRE trata o imóvel:
 *  - ADQUIRIDO: capital investido + projeção de resultado
 *  - VENDIDO: resultado realizado
 *  - CANCELADO: capital investido, reembolsos e perda realizada (sem projeção)
 *  - OUTRO: ainda não adquirido (só capital investido)
 */
export type StatementMode = "ADQUIRIDO" | "VENDIDO" | "CANCELADO" | "OUTRO";

export interface StatementHeaderDto {
  status: ProspectStatus;
  etapa: PostAcquisitionStage | null;
  dataAquisicao: string | null;
  /** Nulo quando a data de aquisição não foi informada (nunca estimado). */
  diasEmCarteira: number | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
}

export interface StatementCardsDto {
  /** Despesas realizadas em categorias de aquisição (nome com "aquisição" ou "compra"). */
  custoAquisicao: string;
  /** R2 — todas as despesas realizadas do imóvel. */
  capitalInvestido: string;
  avaliacao: string | null;
  /** R3 — despesas previstas (cancelados ficam de fora). */
  custosAteVenda: string;
  resultadoProjetado: string | null;
  margemPercentual: string | null;
  roiPercentual: string | null;
  receitasRealizadas: string;
  /** Receitas realizadas na categoria "Reembolso de aquisição". */
  reembolsos: string;
  /** Receitas realizadas − despesas realizadas (negativo = perda). */
  resultadoRealizado: string;
  /** Resultado realizado ÷ receitas realizadas; nulo sem receita. */
  margemRealizadaPercentual: string | null;
}

export interface StatementCategoryLineDto {
  categoryId: string;
  categoryName: string;
  total: string;
  /** % sobre o total das despesas realizadas. */
  percent: string;
}

export interface StatementCapitalPointDto {
  month: string; // "AAAA-MM"
  valorMes: string;
  acumulado: string;
}

export interface StatementOriginDto extends OriginTotalDto {
  percent: string;
}

export interface StatementGroupDto {
  categoryId: string;
  categoryName: string;
  count: number;
  /** Soma do filtro escolhido (cancelados só entram quando o filtro é CANCELADO). */
  subtotal: string;
  percent: string;
  /** Orçado x realizado — só nas categorias de reforma e quando há orçamento no módulo Reforma. */
  reforma: { orcado: string; realizado: string; desvioPercent: string | null } | null;
  lancamentos: TransactionDto[];
}

export interface StatementProjectionDto {
  avaliacao: string;
  custoIncorrido: string;
  custosAteVenda: string;
  resultadoProjetado: string;
  margemPercentual: string | null;
  roiPercentual: string | null;
}

export interface StatementFlowMonthDto extends CashFlowMonthDto {
  /** Mês posterior ao atual (previstos futuros são exibidos em âmbar). */
  futuro: boolean;
}

export interface PropertyStatementDto {
  propertyId: string;
  mode: StatementMode;
  statusFilter: StatementStatusFilter;
  header: StatementHeaderDto;
  cards: StatementCardsDto;
  composicao: StatementCategoryLineDto[];
  capitalAcumulado: StatementCapitalPointDto[];
  origemCapital: StatementOriginDto[];
  despesas: StatementGroupDto[];
  receitas: StatementGroupDto[];
  fluxoMensal: StatementFlowMonthDto[];
  /** Só para imóvel adquirido, não cancelado, com avaliação Caixa. */
  projecaoVenda: StatementProjectionDto | null;
}
