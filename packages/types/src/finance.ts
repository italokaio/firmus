import { z } from "zod";

export const FINANCE_ACCOUNT_LEVELS = ["GERAL", "EMPRESA", "SPE", "IMOVEL"] as const;
export type FinanceAccountLevel = (typeof FINANCE_ACCOUNT_LEVELS)[number];
export const FINANCE_ACCOUNT_LEVEL_LABELS: Record<FinanceAccountLevel, string> = {
  GERAL: "Geral",
  EMPRESA: "Empresa",
  SPE: "SPE",
  IMOVEL: "Imóvel",
};

export const FINANCE_CATEGORY_TYPES = ["RECEITA", "DESPESA"] as const;
export type FinanceCategoryType = (typeof FINANCE_CATEGORY_TYPES)[number];
export const FINANCE_CATEGORY_TYPE_LABELS: Record<FinanceCategoryType, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

export const TRANSACTION_STATUSES = ["PREVISTO", "REALIZADO"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PREVISTO: "Previsto",
  REALIZADO: "Realizado",
};

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "0" : value),
  money,
);

export const createFinanceCategorySchema = z.object({
  name: z.string().min(2),
  type: z.enum(FINANCE_CATEGORY_TYPES),
});
export type CreateFinanceCategoryInput = z.infer<typeof createFinanceCategorySchema>;

export const createFinanceAccountSchema = z.object({
  name: z.string().min(2),
  level: z.enum(FINANCE_ACCOUNT_LEVELS),
  parentAccountId: z.string().uuid().optional(),
  saldoInicial: optionalMoney,
});
export type CreateFinanceAccountInput = z.infer<typeof createFinanceAccountSchema>;

export const updateFinanceAccountSchema = z.object({
  name: z.string().min(2).optional(),
  parentAccountId: z.string().uuid().nullable().optional(),
});
export type UpdateFinanceAccountInput = z.infer<typeof updateFinanceAccountSchema>;

export const createTransactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: money,
  date: z.string().datetime(),
  description: z.string().optional(),
  status: z.enum(TRANSACTION_STATUSES).default("PREVISTO"),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amount: money.optional(),
  date: z.string().datetime().optional(),
  description: z.string().optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  conciliado: z.boolean().optional(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const transactionFilterSchema = z.object({
  status: z.enum(TRANSACTION_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;

export interface FinanceCategoryDto {
  id: string;
  name: string;
  type: FinanceCategoryType;
  createdAt: string;
}

export interface FinanceAccountDto {
  id: string;
  companyId: string;
  propertyId: string | null;
  parentAccountId: string | null;
  level: FinanceAccountLevel;
  name: string;
  saldoInicial: string;
  createdAt: string;
  updatedAt: string;
  /** Presente apenas nas contas retornadas por GET /finance/accounts (listagem com hierarquia). */
  property?: { id: string; origem: string } | null;
  /** Calculado no backend: saldoInicial + realizado (receitas - despesas) desta conta (não recursivo entre subcontas). */
  saldoAtual: string;
}

export interface TransactionDto {
  id: string;
  financeAccountId: string;
  categoryId: string;
  category: { id: string; name: string; type: FinanceCategoryType };
  amount: string;
  date: string;
  description: string | null;
  status: TransactionStatus;
  conciliado: boolean;
  conciliadoEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DreCategoryLineDto {
  categoryId: string;
  categoryName: string;
  total: string;
}

export interface DreDto {
  propertyId: string;
  receitas: DreCategoryLineDto[];
  despesas: DreCategoryLineDto[];
  totalReceitas: string;
  totalDespesas: string;
  lucroLiquido: string;
  margemPercentual: string | null;
}

export interface CashFlowMonthDto {
  month: string; // "YYYY-MM"
  previstoEntradas: string;
  previstoSaidas: string;
  realizadoEntradas: string;
  realizadoSaidas: string;
  saldoAcumulado: string;
}

export interface FinanceSummaryDto {
  saldoConsolidado: string;
  totalReceitasMes: string;
  totalDespesasMes: string;
}
