import { z } from "zod";

export const updateCompanyProfileSchema = z.object({
  name: z.string().min(2),
});
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;
