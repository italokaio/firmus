import { z } from "zod";
import { PRIORITIES, type Priority } from "./properties";

export const RENOVATION_STAGES = [
  "PLANEJAMENTO",
  "ORCAMENTO",
  "COMPRAS",
  "DEMOLICAO",
  "ALVENARIA",
  "ELETRICA",
  "HIDRAULICA",
  "PINTURA",
  "ACABAMENTO",
  "LIMPEZA",
  "FOTOGRAFIA",
  "FINALIZADO",
] as const;
export type RenovationStage = (typeof RENOVATION_STAGES)[number];

export const RENOVATION_STAGE_LABELS: Record<RenovationStage, string> = {
  PLANEJAMENTO: "Planejamento",
  ORCAMENTO: "Orçamento",
  COMPRAS: "Compras",
  DEMOLICAO: "Demolição",
  ALVENARIA: "Alvenaria",
  ELETRICA: "Elétrica",
  HIDRAULICA: "Hidráulica",
  PINTURA: "Pintura",
  ACABAMENTO: "Acabamento",
  LIMPEZA: "Limpeza",
  FOTOGRAFIA: "Fotografia",
  FINALIZADO: "Finalizado",
};

export const RENOVATION_MEDIA_KINDS = ["FOTO", "VIDEO"] as const;
export type RenovationMediaKind = (typeof RENOVATION_MEDIA_KINDS)[number];

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "0" : value),
  money,
);

export const createRenovationTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  stage: z.enum(RENOVATION_STAGES).default("PLANEJAMENTO"),
  responsibleId: z.string().uuid().optional(),
  priority: z.enum(PRIORITIES).default("MEDIA"),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  valorPrevisto: optionalMoney,
  dependsOnTaskIds: z.array(z.string().uuid()).default([]),
});
export type CreateRenovationTaskInput = z.infer<typeof createRenovationTaskSchema>;

export const updateRenovationTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  responsibleId: z.string().uuid().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  valorPrevisto: optionalMoney.optional(),
  valorRealizado: optionalMoney.optional(),
  percentualConcluido: z.coerce.number().int().min(0).max(100).optional(),
  dependsOnTaskIds: z.array(z.string().uuid()).optional(),
});
export type UpdateRenovationTaskInput = z.infer<typeof updateRenovationTaskSchema>;

export const moveRenovationTaskSchema = z.object({
  stage: z.enum(RENOVATION_STAGES),
  order: z.number().int().min(0),
});
export type MoveRenovationTaskInput = z.infer<typeof moveRenovationTaskSchema>;

export const createChecklistItemSchema = z.object({
  title: z.string().min(1),
});
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;

export const updateChecklistItemSchema = z.object({
  done: z.boolean(),
});
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;

export const createRenovationCommentSchema = z.object({
  body: z.string().min(1),
});
export type CreateRenovationCommentInput = z.infer<typeof createRenovationCommentSchema>;

export const confirmRenovationMediaSchema = z.object({
  storageKey: z.string().min(1),
  kind: z.enum(RENOVATION_MEDIA_KINDS),
  caption: z.string().optional(),
});
export type ConfirmRenovationMediaInput = z.infer<typeof confirmRenovationMediaSchema>;

export interface RenovationChecklistItemDto {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface RenovationCommentDto {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface RenovationMediaDto {
  id: string;
  taskId: string;
  kind: RenovationMediaKind;
  storageKey: string;
  url: string;
  caption: string | null;
  createdAt: string;
}

export interface RenovationTaskDto {
  id: string;
  propertyId: string;
  stage: RenovationStage;
  order: number;
  title: string;
  description: string | null;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  valorPrevisto: string;
  valorRealizado: string;
  percentualConcluido: number;
  createdAt: string;
  updatedAt: string;
  responsible: { id: string; name: string } | null;
  checklist: RenovationChecklistItemDto[];
  comments: RenovationCommentDto[];
  media: RenovationMediaDto[];
  dependsOn: Array<{ dependsOnTaskId: string; dependsOn: { id: string; title: string; stage: RenovationStage } }>;
  /** Presente apenas na listagem global do kanban (todas as propriedades). */
  property?: { id: string; origem: string; endereco: string };
}
