import { z } from "zod";
import { TRANSACTION_ORIGEM_TIPOS, TRANSACTION_STATUSES_EDITABLE, money, refineOrigem } from "./finance";

export const OPERATION_TYPES = ["LEILAO", "VENDA_DIRETA", "GESTAO_TERCEIROS"] as const;
export const AUCTION_TYPES = ["JUDICIAL", "EXTRAJUDICIAL"] as const;
export const OCCUPANCY_STATUSES = ["OCUPADO", "DESOCUPADO", "NAO_INFORMADO"] as const;
export const LEGAL_RISK_LEVELS = ["BAIXO", "MEDIO", "ALTO"] as const;
export const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;
export const PROSPECT_STATUSES = [
  "NOVA_OPORTUNIDADE",
  "EM_ANALISE",
  "APROVADA",
  "REPROVADA",
  "EM_DUE_DILIGENCE",
  "ADQUIRIDA",
  "VENDIDA",
  "DESCARTADA",
  "AQUISICAO_CANCELADA",
] as const;

export const POST_ACQUISITION_STAGES = ["DESOCUPACAO_DOCUMENTACAO", "REFORMA", "A_VENDA", "VENDIDO"] as const;
export type PostAcquisitionStage = (typeof POST_ACQUISITION_STAGES)[number];
export const POST_ACQUISITION_STAGE_LABELS: Record<PostAcquisitionStage, string> = {
  DESOCUPACAO_DOCUMENTACAO: "Desocupação / Documentação",
  REFORMA: "Reforma",
  A_VENDA: "À venda",
  VENDIDO: "Vendido",
};

export type OperationType = (typeof OPERATION_TYPES)[number];
export type AuctionType = (typeof AUCTION_TYPES)[number];
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];
export type LegalRiskLevel = (typeof LEGAL_RISK_LEVELS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  NOVA_OPORTUNIDADE: "Nova oportunidade",
  EM_ANALISE: "Em análise",
  APROVADA: "Aprovada",
  REPROVADA: "Reprovada",
  EM_DUE_DILIGENCE: "Em due diligence",
  ADQUIRIDA: "Adquirida",
  VENDIDA: "Vendida",
  DESCARTADA: "Descartada",
  AQUISICAO_CANCELADA: "Aquisição cancelada",
};

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  LEILAO: "Leilão",
  VENDA_DIRETA: "Venda direta (corretor / financiamento)",
  GESTAO_TERCEIROS: "Gestão para terceiros",
};

/**
 * EM_DUE_DILIGENCE e ADQUIRIDA só fazem sentido no funil de leilão (dependem
 * de checklist de due diligence e registro de Aquisição, exclusivos de
 * `tipoOperacao = LEILAO`). Para os demais tipos de operação, o formulário e
 * os filtros mostram só este subconjunto.
 */
export const PROSPECT_STATUSES_NON_LEILAO = PROSPECT_STATUSES.filter(
  (status) => status !== "EM_DUE_DILIGENCE" && status !== "ADQUIRIDA" && status !== "AQUISICAO_CANCELADA",
);

/**
 * Status que o usuário pode atribuir diretamente (cadastro/edição). AQUISICAO_CANCELADA fica de fora:
 * só é atingido pelo fluxo de cancelamento (irreversível, com motivo e tratamento dos lançamentos).
 */
export const PROSPECT_STATUSES_SELECTABLE = PROSPECT_STATUSES.filter((status) => status !== "AQUISICAO_CANCELADA");

export function statusesForOperationType(tipoOperacao: OperationType): readonly ProspectStatus[] {
  return tipoOperacao === "LEILAO" ? PROSPECT_STATUSES_SELECTABLE : PROSPECT_STATUSES_NON_LEILAO;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const AUCTION_TYPE_LABELS: Record<AuctionType, string> = {
  JUDICIAL: "Judicial",
  EXTRAJUDICIAL: "Extrajudicial",
};

export const OCCUPANCY_LABELS: Record<OccupancyStatus, string> = {
  OCUPADO: "Ocupado",
  DESOCUPADO: "Desocupado",
  NAO_INFORMADO: "Não informado",
};

export const LEGAL_RISK_LABELS: Record<LegalRiskLevel, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
};

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

/** Mesma validação de `decimalString`, mas trata campo vazio como "não informado". */
const optionalDecimalString = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  decimalString.optional(),
);

const optionalNonNegativeInt = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().min(0).optional(),
);

const propertyBaseSchema = z.object({
  tipoOperacao: z.enum(OPERATION_TYPES).default("LEILAO"),

  origem: z.string().min(2),
  /** Obrigatório apenas quando tipoOperacao = LEILAO — ver superRefine abaixo. */
  tipoLeilao: z.enum(AUCTION_TYPES).optional(),
  editalUrl: z.string().url().optional().or(z.literal("")),

  /** Só relevante para VENDA_DIRETA/GESTAO_TERCEIROS (imóvel de terceiro). */
  proprietarioNome: z.string().optional(),
  proprietarioContato: z.string().optional(),

  cidade: z.string().min(2),
  estado: z.string().length(2),
  endereco: z.string().min(5),
  matricula: z.string().optional(),

  area: decimalString,
  dormitorios: optionalNonNegativeInt,
  banheiros: optionalNonNegativeInt,
  garagens: optionalNonNegativeInt,

  valorAvaliacao: decimalString,
  /** Obrigatórios apenas quando tipoOperacao = LEILAO (lance) — ver superRefine abaixo. */
  valorMinimo: optionalDecimalString,
  valorMaximoOferta: optionalDecimalString,
  valorMercadoEstimado: optionalDecimalString,

  ocupacao: z.enum(OCCUPANCY_STATUSES).default("NAO_INFORMADO"),
  riscoJuridico: z.enum(LEGAL_RISK_LEVELS).default("MEDIO"),
  observacoes: z.string().optional(),

  status: z.enum(PROSPECT_STATUSES_SELECTABLE as unknown as [ProspectStatus, ...ProspectStatus[]]).default("NOVA_OPORTUNIDADE"),
  prioridade: z.enum(PRIORITIES).default("MEDIA"),
  /** Etapa depois de adquirido — opcional, preenchida manualmente (sem automação). */
  etapaPosAquisicao: z.enum(POST_ACQUISITION_STAGES).nullable().optional(),

  tagIds: z.array(z.string().uuid()).default([]),
});

export const createPropertySchema = propertyBaseSchema.superRefine((data, ctx) => {
  if (data.tipoOperacao !== "LEILAO") return;
  if (!data.tipoLeilao) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tipoLeilao"], message: "Obrigatório para imóveis de leilão" });
  }
  if (!data.valorMinimo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valorMinimo"], message: "Obrigatório para imóveis de leilão" });
  }
  if (!data.valorMaximoOferta) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valorMaximoOferta"], message: "Obrigatório para imóveis de leilão" });
  }
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = propertyBaseSchema.partial();
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const propertyFilterSchema = z.object({
  status: z.enum(PROSPECT_STATUSES).optional(),
  prioridade: z.enum(PRIORITIES).optional(),
  tagId: z.string().uuid().optional(),
  search: z.string().optional(),
});
export type PropertyFilterInput = z.infer<typeof propertyFilterSchema>;

export interface TagDto {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface PropertyPhotoDto {
  id: string;
  propertyId: string;
  storageKey: string;
  url: string;
  caption: string | null;
  order: number;
  createdAt: string;
}

export interface PropertyDocumentDto {
  id: string;
  propertyId: string;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  previousVersionId: string | null;
  createdAt: string;
}

/** Formato retornado pela API — os campos Decimal do Prisma chegam como string via JSON. */
export interface PropertyDto {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  tipoOperacao: OperationType;
  origem: string;
  tipoLeilao: AuctionType | null;
  editalUrl: string | null;
  proprietarioNome: string | null;
  proprietarioContato: string | null;
  cidade: string;
  estado: string;
  endereco: string;
  matricula: string | null;
  area: string;
  dormitorios: number | null;
  banheiros: number | null;
  garagens: number | null;
  valorAvaliacao: string;
  valorMinimo: string | null;
  valorMaximoOferta: string | null;
  valorMercadoEstimado: string | null;
  ocupacao: OccupancyStatus;
  riscoJuridico: LegalRiskLevel;
  observacoes: string | null;
  status: ProspectStatus;
  prioridade: Priority;
  etapaPosAquisicao: PostAcquisitionStage | null;
  createdByUserId: string | null;
  corretorResponsavelId: string | null;
  /** Preenchidos quando status = AQUISICAO_CANCELADA. */
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  canceladoPor: { id: string; name: string } | null;
  /** Calculado na listagem e no detalhe: há lançamento realizado (bloqueia a exclusão). */
  hasRealizedTransactions?: boolean;
  photos: PropertyPhotoDto[];
  documents: PropertyDocumentDto[];
  tags: Array<{ tag: TagDto }>;
}

export const createTagSchema = z.object({
  name: z.string().min(2),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#6366F1"),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const presignUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  kind: z.enum(["PHOTO", "DOCUMENT"]),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const confirmPhotoUploadSchema = z.object({
  storageKey: z.string().min(1),
  caption: z.string().optional(),
});
export type ConfirmPhotoUploadInput = z.infer<typeof confirmPhotoUploadSchema>;

export const confirmDocumentUploadSchema = z.object({
  storageKey: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  /** Quando presente, esta versão substitui um documento existente. */
  previousDocumentId: z.string().uuid().optional(),
});
export type ConfirmDocumentUploadInput = z.infer<typeof confirmDocumentUploadSchema>;

// ---------- Cancelamento de aquisição ----------

export const cancelAcquisitionSchema = z.object({
  /** Obrigatório (C2). */
  motivo: z.string().trim().min(3, "Informe o motivo do cancelamento"),
  /** Data do cancelamento (C2). */
  data: z.string().datetime(),
  /** Devolução total ou parcial, registrada como receita de reembolso (C7). */
  reembolso: z
    .object({
      valor: money,
      data: z.string().datetime(),
      status: z.enum(TRANSACTION_STATUSES_EDITABLE).default("REALIZADO"),
      origemTipo: z.enum(TRANSACTION_ORIGEM_TIPOS).nullable().optional(),
      investidorId: z.string().uuid().nullable().optional(),
    })
    .superRefine((value, ctx) => {
      if (!(Number(value.valor) > 0)) {
        ctx.addIssue({ code: "custom", path: ["valor"], message: "O valor do reembolso deve ser maior que zero" });
      }
      refineOrigem(value, ctx);
    })
    .optional(),
});
export type CancelAcquisitionInput = z.infer<typeof cancelAcquisitionSchema>;

/** Prévia do que o cancelamento fará, para o diálogo de confirmação. */
export interface CancelImpactDto {
  previstosCount: number;
  previstosTotal: string;
  realizadoReceitas: string;
  realizadoDespesas: string;
  /** Receitas realizadas − despesas realizadas (negativo = perda). */
  resultadoRealizado: string;
}

export interface CancelAcquisitionResultDto {
  property: PropertyDto;
  canceledTransactions: number;
  reimbursementTransactionId: string | null;
}
