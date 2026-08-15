import { z } from "zod";

export const SIMULATOR_SCENARIO_TYPES = ["OTIMISTA", "REALISTA", "PESSIMISTA"] as const;
export type SimulatorScenarioType = (typeof SIMULATOR_SCENARIO_TYPES)[number];
export const SIMULATOR_SCENARIO_TYPE_LABELS: Record<SimulatorScenarioType, string> = {
  OTIMISTA: "Otimista",
  REALISTA: "Realista",
  PESSIMISTA: "Pessimista",
};

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "0" : value),
  money,
);

const percentage = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um percentual válido");

const optionalPercentage = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "12" : value),
  percentage,
);

export const upsertSimulatorScenarioSchema = z.object({
  capitalInvestido: money,
  valorVendaEstimado: money,
  custosVenda: optionalMoney,
  prazoMeses: z.coerce.number().int().min(1).max(240),
  taxaDescontoAnual: optionalPercentage,
  observacoes: z.string().optional(),
});
export type UpsertSimulatorScenarioInput = z.infer<typeof upsertSimulatorScenarioSchema>;

export interface SimulatorScenarioDto {
  id: string;
  propertyId: string;
  tipo: SimulatorScenarioType;
  capitalInvestido: string;
  valorVendaEstimado: string;
  custosVenda: string;
  prazoMeses: number;
  taxaDescontoAnual: string;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Lucro bruto = valor de venda - custos de venda - capital investido. */
  lucroBruto: string;
  /** Retorno sobre o capital investido, em %. */
  roi: string;
  /** Margem sobre o valor de venda, em %. `null` se valor de venda for zero. */
  margem: string | null;
  /** Meses até recuperar o capital investido — igual ao prazo se a operação for lucrativa, senão `null`. */
  paybackMeses: number | null;
  /** TIR anualizada, em %. `null` quando o retorno líquido não é positivo (sem raiz real). */
  tirAnual: string | null;
  /** VPL descontado pela taxa anual informada, trazido a valor presente no mês 0. */
  vpl: string;
}

export interface SimulatorSuggestedInputsDto {
  capitalInvestidoSugerido: string;
  valorAvaliacaoImovel: string;
}

export interface SimulatorOverviewDto {
  scenarios: SimulatorScenarioDto[];
  suggestedInputs: SimulatorSuggestedInputsDto;
}
