import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roleIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um papel"),
  /** Vincula a conta a um Investor existente — escopa o acesso à própria participação. */
  investorId: z.string().uuid().optional(),
  /** Vincula a conta a um Broker existente — escopa o acesso aos próprios imóveis/vendas. */
  brokerId: z.string().uuid().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).min(1).optional(),
  investorId: z.string().uuid().nullable().optional(),
  brokerId: z.string().uuid().nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
