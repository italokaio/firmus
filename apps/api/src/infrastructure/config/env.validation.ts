import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(30),
  /** `secure` dos cookies de sessão — precisa ser true atrás de HTTPS em produção. */
  COOKIE_SECURE: z.string().default("false"),
  COOKIE_DOMAIN: z.string().optional(),

  /** Exigida em POST /companies/register (tela avulsa /setup/nova-empresa) — troque em produção. */
  COMPANY_SETUP_KEY: z.string().min(8).default("troque-esta-chave-em-producao"),

  STORAGE_ENDPOINT: z.string().default("http://localhost:9000"),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().default("leilao-erp-dev"),
  STORAGE_ACCESS_KEY: z.string().default("leilao"),
  STORAGE_SECRET_KEY: z.string().default("leilao12345"),
  STORAGE_FORCE_PATH_STYLE: z.string().default("true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return result.data;
}
