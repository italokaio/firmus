import { z } from "zod";

export const loginSchema = z.object({
  companySlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerCompanySchema = z.object({
  companyName: z.string().min(2),
  companyDocument: z.string().min(11, "Informe um CPF/CNPJ válido"),
  companySlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  /** Chave de configuração exigida pelo backend (env COMPANY_SETUP_KEY) — não é um dado da empresa. */
  setupKey: z.string().min(1),
});
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  /** Presente quando a conta está vinculada a um Investor — escopa o acesso à própria participação. */
  investorId: z.string().uuid().optional(),
  /** Presente quando a conta está vinculada a um Broker — escopa o acesso aos próprios imóveis/vendas. */
  brokerId: z.string().uuid().optional(),
});
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Tipo interno do backend — os tokens nunca saem em JSON, só como cookies httpOnly (ver auth-cookies.ts). */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const loginResponseSchema = z.object({
  user: authenticatedUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Resposta do login quando o usuário tem 2FA ativo — sessão ainda não foi emitida. */
export interface LoginRequiresTwoFactorResponse {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

export type LoginResult = LoginResponse | LoginRequiresTwoFactorResponse;

/** Payload assinado dentro do JWT de access token. */
export interface JwtAccessPayload {
  sub: string;
  companyId: string;
  roles: string[];
  permissions: string[];
  investorId?: string;
  brokerId?: string;
}

const totpCodeSchema = z.string().regex(/^\d{6}$/, "Informe os 6 dígitos do código");

export const twoFactorVerifySetupSchema = z.object({ code: totpCodeSchema });
export type TwoFactorVerifySetupInput = z.infer<typeof twoFactorVerifySetupSchema>;

export const twoFactorDisableSchema = z.object({ code: totpCodeSchema });
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

export const loginVerifyTwoFactorSchema = z.object({
  twoFactorToken: z.string().min(10),
  code: totpCodeSchema,
});
export type LoginVerifyTwoFactorInput = z.infer<typeof loginVerifyTwoFactorSchema>;

export interface TwoFactorSetupDto {
  secret: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorStatusDto {
  enabled: boolean;
}
