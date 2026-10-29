import { z } from "zod";
import type { Priority, PostAcquisitionStage } from "./properties";
import type { OriginTotalDto } from "./finance";

/** Mês do dashboard no formato AAAA-MM (padrão: mês atual). */
export const portfolioQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe o mês no formato AAAA-MM")
    .optional(),
});
export type PortfolioQueryInput = z.infer<typeof portfolioQuerySchema>;

/** Passos do funil, na ordem exibida. */
export const FUNNEL_STEPS = [
  "EM_ANALISE",
  "DESOCUPACAO_DOCUMENTACAO",
  "REFORMA",
  "A_VENDA",
  "VENDIDO",
] as const;
export type FunnelStepKey = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_STEP_LABELS: Record<FunnelStepKey, string> = {
  EM_ANALISE: "Em análise",
  DESOCUPACAO_DOCUMENTACAO: "Desocupação / Documentação",
  REFORMA: "Reforma",
  A_VENDA: "À venda",
  VENDIDO: "Vendido",
};
export const NO_STAGE_LABEL = "Etapa não definida";

export interface FunnelStepDto {
  key: FunnelStepKey;
  label: string;
  count: number;
  /** Capital investido (despesas realizadas) nos imóveis desta etapa. */
  capital: string;
}

export interface PortfolioAcquiredRowDto {
  id: string;
  origem: string;
  prioridade: Priority;
  etapa: PostAcquisitionStage | null;
  dataAquisicao: string | null;
  /** Dias desde `dataAquisicao`; null quando a data não foi informada (nunca estimada). */
  diasEmCarteira: number | null;
  custoIncorrido: string;
  avaliacao: string | null;
  resultadoProjetado: string | null;
  margemPercentual: string | null;
  semAvaliacao: boolean;
}

export type AlertTone = "negative" | "forecast" | "info";
export interface PortfolioAlertDto {
  id: string;
  tone: AlertTone;
  message: string;
  count: number;
  /** Imóveis envolvidos (o primeiro vira o link quando só há um). */
  propertyIds: string[];
}

export interface PortfolioDashboardDto {
  month: string;
  counts: {
    cadastrados: number;
    emAnalise: number;
    adquiridos: number;
    vendidos: number;
    reprovados: number;
    cancelados: number;
  };
  /** Resultado realizado (receitas − despesas realizadas) somado dos imóveis com aquisição cancelada. */
  canceladosResultadoRealizado: string;
  funnel: FunnelStepDto[];
  /** Adquiridos sem etapa pós-aquisição definida (ficam fora dos passos do funil). */
  semEtapa: { count: number; capital: string };
  carteira: {
    /** Despesas realizadas de todos os adquiridos (inclui os sem avaliação). */
    capitalInvestido: string;
    /** Projeção: só adquiridos COM avaliação Caixa (R7). */
    avaliacao: string;
    custoIncorrido: string;
    custosAteVenda: string;
    resultadoProjetado: string;
    margemPercentual: string | null;
    roiPercentual: string | null;
    imoveisNaProjecao: number;
    imoveisSemAvaliacao: number;
  };
  caixa: {
    saldoConsolidado: string;
    receitasRealizadasMes: string;
    despesasRealizadasMes: string;
    /** Despesas previstas com data entre hoje e hoje + 90 dias. */
    saidasPrevistas90Dias: string;
    /** Soma dos aportes cadastrados nas participações (informativo — não entra no saldo). */
    aportesRegistrados: string;
  };
  /** Despesas realizadas dos adquiridos por "Pago por"; "Não informado" convida a completar os lançamentos. */
  origemCapital: OriginTotalDto[];
  adquiridos: PortfolioAcquiredRowDto[];
  alertas: PortfolioAlertDto[];
}
