import { z } from "zod";

export const SALE_STATUSES = [
  "EM_PROSPECCAO",
  "PROPOSTA_RECEBIDA",
  "EM_NEGOCIACAO",
  "CONTRATO_ASSINADO",
  "AGUARDANDO_FINANCIAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  EM_PROSPECCAO: "Em prospecção de comprador",
  PROPOSTA_RECEBIDA: "Proposta recebida",
  EM_NEGOCIACAO: "Em negociação",
  CONTRATO_ASSINADO: "Contrato assinado",
  AGUARDANDO_FINANCIAMENTO: "Aguardando financiamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const PROPOSAL_STATUSES = ["PENDENTE", "ACEITA", "RECUSADA", "RETIRADA"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  PENDENTE: "Pendente",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  RETIRADA: "Retirada",
};

export const FINANCING_STATUSES = ["EM_ANALISE", "APROVADO", "REPROVADO"] as const;
export type FinancingStatus = (typeof FINANCING_STATUSES)[number];
export const FINANCING_STATUS_LABELS: Record<FinancingStatus, string> = {
  EM_ANALISE: "Em análise",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

export const RECEIVABLE_STATUSES = ["PENDENTE", "PAGO"] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];
export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
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
  (value) => (value === "" || value === undefined || value === null ? "0" : value),
  percentage,
);

// ---------- Corretor ----------

export const createBrokerSchema = z.object({
  name: z.string().min(2),
  document: z.string().optional(),
  creci: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  observacoes: z.string().optional(),
});
export type CreateBrokerInput = z.infer<typeof createBrokerSchema>;
export const updateBrokerSchema = createBrokerSchema.partial();
export type UpdateBrokerInput = z.infer<typeof updateBrokerSchema>;

export interface BrokerDto {
  id: string;
  name: string;
  document: string | null;
  creci: string | null;
  email: string | null;
  phone: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  salesCount?: number;
}

// ---------- Venda ----------

export const createSaleSchema = z.object({
  brokerId: z.string().uuid().optional(),
  valorPedido: money,
  comissaoPercentual: optionalPercentage,
  observacoes: z.string().optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const updateSaleSchema = z.object({
  status: z.enum(SALE_STATUSES).optional(),
  brokerId: z.string().uuid().nullable().optional(),
  valorPedido: money.optional(),
  comissaoPercentual: percentage.optional(),
  observacoes: z.string().optional(),
});
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;

export interface SaleDto {
  id: string;
  propertyId: string;
  brokerId: string | null;
  broker: { id: string; name: string } | null;
  status: SaleStatus;
  valorPedido: string;
  comissaoPercentual: string;
  dataInicio: string;
  dataConclusao: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  proposals: ProposalDto[];
  contract: SaleContractDto | null;
  financing: FinancingDto | null;
  receivables: ReceivableDto[];
}

/** Item leve da listagem global (GET /sales) — sem sub-recursos aninhados. */
export interface SaleListItemDto {
  id: string;
  propertyId: string;
  property: { id: string; origem: string };
  brokerId: string | null;
  broker: { id: string; name: string } | null;
  status: SaleStatus;
  valorPedido: string;
  dataInicio: string;
  dataConclusao: string | null;
}

// ---------- Proposta ----------

export const createProposalSchema = z.object({
  buyerName: z.string().min(2),
  buyerDocument: z.string().optional(),
  buyerContact: z.string().optional(),
  valorOferta: money,
  dataProposta: z.string().datetime().optional(),
  observacoes: z.string().optional(),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const updateProposalSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  valorOferta: money.optional(),
  observacoes: z.string().optional(),
});
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;

export interface ProposalDto {
  id: string;
  saleId: string;
  buyerName: string;
  buyerDocument: string | null;
  buyerContact: string | null;
  valorOferta: string;
  status: ProposalStatus;
  dataProposta: string;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Contrato ----------

export const upsertSaleContractSchema = z.object({
  valorVenda: money,
  dataAssinatura: z.string().datetime().optional(),
  storageKey: z.string().optional(),
  observacoes: z.string().optional(),
});
export type UpsertSaleContractInput = z.infer<typeof upsertSaleContractSchema>;

export interface SaleContractDto {
  id: string;
  saleId: string;
  valorVenda: string;
  dataAssinatura: string | null;
  storageKey: string | null;
  documentUrl: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Financiamento ----------

export const upsertFinancingSchema = z.object({
  bankName: z.string().optional(),
  valorFinanciado: money,
  prazoMeses: z.coerce.number().int().min(1).max(480).optional(),
  status: z.enum(FINANCING_STATUSES).default("EM_ANALISE"),
  observacoes: z.string().optional(),
});
export type UpsertFinancingInput = z.infer<typeof upsertFinancingSchema>;

export interface FinancingDto {
  id: string;
  saleId: string;
  bankName: string | null;
  valorFinanciado: string;
  prazoMeses: number | null;
  status: FinancingStatus;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Recebíveis (parcelas) ----------

export const createReceivableSchema = z.object({
  numeroParcela: z.coerce.number().int().min(1),
  valor: money,
  dataVencimento: z.string().datetime(),
  observacoes: z.string().optional(),
});
export type CreateReceivableInput = z.infer<typeof createReceivableSchema>;

export const updateReceivableSchema = z.object({
  valor: money.optional(),
  dataVencimento: z.string().datetime().optional(),
  status: z.enum(RECEIVABLE_STATUSES).optional(),
  observacoes: z.string().optional(),
});
export type UpdateReceivableInput = z.infer<typeof updateReceivableSchema>;

export interface ReceivableDto {
  id: string;
  saleId: string;
  numeroParcela: number;
  valor: string;
  dataVencimento: string;
  dataPagamento: string | null;
  status: ReceivableStatus;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  /** `status === "PENDENTE"` e `dataVencimento` no passado. */
  atrasado: boolean;
}
