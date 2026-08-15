import { z } from "zod";

export const DUE_DILIGENCE_ITEM_TYPES = [
  "MATRICULA",
  "IPTU",
  "CONDOMINIO",
  "ONUS",
  "ACOES",
  "DEBITOS",
  "FOTOS",
  "LAUDO",
  "PARECER_JURIDICO",
  "ANALISE_DOCUMENTAL",
  "OUTRO",
] as const;
export type DueDiligenceItemType = (typeof DUE_DILIGENCE_ITEM_TYPES)[number];

export const DUE_DILIGENCE_STATUSES = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO", "REPROVADO"] as const;
export type DueDiligenceStatus = (typeof DUE_DILIGENCE_STATUSES)[number];

export const DUE_DILIGENCE_ITEM_TYPE_LABELS: Record<DueDiligenceItemType, string> = {
  MATRICULA: "Matrícula",
  IPTU: "IPTU",
  CONDOMINIO: "Condomínio",
  ONUS: "Ônus",
  ACOES: "Ações",
  DEBITOS: "Débitos",
  FOTOS: "Fotos",
  LAUDO: "Laudo",
  PARECER_JURIDICO: "Parecer jurídico",
  ANALISE_DOCUMENTAL: "Análise documental",
  OUTRO: "Outro",
};

export const DUE_DILIGENCE_STATUS_LABELS: Record<DueDiligenceStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  REPROVADO: "Reprovado",
};

/** Checklist padrão criado ao iniciar a due diligence de um imóvel. */
export const DEFAULT_DUE_DILIGENCE_ITEMS: Array<{
  type: DueDiligenceItemType;
  title: string;
  critical: boolean;
}> = [
  { type: "MATRICULA", title: "Matrícula atualizada", critical: true },
  { type: "IPTU", title: "Certidão negativa de IPTU", critical: true },
  { type: "CONDOMINIO", title: "Certidão negativa de condomínio", critical: true },
  { type: "ONUS", title: "Certidão de ônus reais", critical: true },
  { type: "ACOES", title: "Certidão de ações judiciais", critical: true },
  { type: "DEBITOS", title: "Levantamento de débitos em geral", critical: true },
  { type: "FOTOS", title: "Fotos do imóvel", critical: false },
  { type: "LAUDO", title: "Laudo de avaliação/vistoria", critical: false },
  { type: "PARECER_JURIDICO", title: "Parecer jurídico", critical: true },
  { type: "ANALISE_DOCUMENTAL", title: "Análise documental completa", critical: true },
];

export const createDueDiligenceItemSchema = z.object({
  type: z.enum(DUE_DILIGENCE_ITEM_TYPES),
  title: z.string().min(2),
  description: z.string().optional(),
  critical: z.boolean().default(true),
  responsibleId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateDueDiligenceItemInput = z.infer<typeof createDueDiligenceItemSchema>;

export const updateDueDiligenceItemSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  critical: z.boolean().optional(),
  status: z.enum(DUE_DILIGENCE_STATUSES).optional(),
  responsibleId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type UpdateDueDiligenceItemInput = z.infer<typeof updateDueDiligenceItemSchema>;

export const createDueDiligenceCommentSchema = z.object({
  body: z.string().min(1),
});
export type CreateDueDiligenceCommentInput = z.infer<typeof createDueDiligenceCommentSchema>;

export const confirmDueDiligenceFileSchema = z.object({
  storageKey: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});
export type ConfirmDueDiligenceFileInput = z.infer<typeof confirmDueDiligenceFileSchema>;

export interface DueDiligenceFileDto {
  id: string;
  itemId: string;
  name: string;
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DueDiligenceCommentDto {
  id: string;
  itemId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface DueDiligenceItemDto {
  id: string;
  propertyId: string;
  type: DueDiligenceItemType;
  title: string;
  description: string | null;
  critical: boolean;
  status: DueDiligenceStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  responsible: { id: string; name: string } | null;
  comments: DueDiligenceCommentDto[];
  files: DueDiligenceFileDto[];
}
