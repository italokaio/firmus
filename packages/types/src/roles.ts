import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
