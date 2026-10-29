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

export const TRANSACTION_STATUSES = ["PREVISTO", "REALIZADO", "CANCELADO"] as const;
/** Status que o usuário pode definir à mão. CANCELADO só é atribuído pelo cancelamento da aquisição. */
export const TRANSACTION_STATUSES_EDITABLE = ["PREVISTO", "REALIZADO"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PREVISTO: "Previsto",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
};

/** "Pago por": de quem saiu o dinheiro do lançamento. `EMPRESA` é a opção única "Caixa da empresa". */
export const TRANSACTION_ORIGEM_TIPOS = ["INVESTIDOR", "EMPRESA"] as const;
export type TransactionOrigemTipo = (typeof TRANSACTION_ORIGEM_TIPOS)[number];
export const EMPRESA_ORIGEM_LABEL = "Caixa da empresa";
/** Categoria de receita criada no cancelamento da aquisição quando há devolução. */
export const REIMBURSEMENT_CATEGORY_NAME = "Reembolso de aquisição";
export const ORIGEM_NAO_INFORMADA_LABEL = "Não informado";

export const money = z
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

const origemFields = {
  origemTipo: z.enum(TRANSACTION_ORIGEM_TIPOS).nullable().optional(),
  investidorId: z.string().uuid().nullable().optional(),
};

/** INVESTIDOR exige investidorId; EMPRESA (ou sem origem) não pode trazer investidorId. */
export function refineOrigem(
  value: { origemTipo?: TransactionOrigemTipo | null; investidorId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.origemTipo === "INVESTIDOR" && !value.investidorId) {
    ctx.addIssue({ code: "custom", path: ["investidorId"], message: "Selecione o investidor" });
  }
  if (value.origemTipo !== "INVESTIDOR" && value.investidorId) {
    ctx.addIssue({
      code: "custom",
      path: ["origemTipo"],
      message: "Informe a origem como investidor para vincular um investidor",
    });
  }
}

export const createTransactionSchema = z
  .object({
    categoryId: z.string().uuid(),
    amount: money,
    date: z.string().datetime(),
    description: z.string().optional(),
    status: z.enum(TRANSACTION_STATUSES_EDITABLE).default("PREVISTO"),
    ...origemFields,
  })
  .superRefine(refineOrigem);
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    amount: money.optional(),
    date: z.string().datetime().optional(),
    description: z.string().optional(),
    status: z.enum(TRANSACTION_STATUSES_EDITABLE).optional(),
    conciliado: z.boolean().optional(),
    ...origemFields,
  })
  .superRefine((value, ctx) => {
    // Só valida a origem quando ela faz parte da edição — enviar apenas
    // investidorId (sem origemTipo) cai na regra de refineOrigem.
    if (value.origemTipo !== undefined || value.investidorId !== undefined) refineOrigem(value, ctx);
  });
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const transactionFilterSchema = z.object({
  status: z.enum(TRANSACTION_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;

/** Filtros da exportação/extrato de lançamentos (toda a empresa). `origem` = "EMPRESA", "NAO_INFORMADO" ou o id de um investidor. */
export const transactionExportFilterSchema = transactionFilterSchema.extend({
  propertyId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  origem: z.string().min(1).optional(),
});
export type TransactionExportFilterInput = z.infer<typeof transactionExportFilterSchema>;

export const ORIGEM_FILTER_EMPRESA = "EMPRESA";
export const ORIGEM_FILTER_NAO_INFORMADO = "NAO_INFORMADO";

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
  origemTipo: TransactionOrigemTipo | null;
  investidorId: string | null;
  investidor: { id: string; name: string } | null;
  /** Há alterações registradas no histórico (habilita o link "Ver histórico"). */
  hasHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionHistoryEntryDto {
  id: string;
  createdAt: string;
  userName: string | null;
  /** Nome legível do campo alterado (ex.: "Valor", "Pago por"). */
  field: string;
  before: string;
  after: string;
}

/** Soma de lançamentos por origem ("Pago por"). `key` = id do investidor, "EMPRESA" ou "NAO_INFORMADO". */
export interface OriginTotalDto {
  key: string;
  label: string;
  total: string;
  count: number;
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
