import { join } from "node:path";
import { PRINT_THEME } from "@leilao-erp/types";

/**
 * Recursos do tema de impressão (fontes Poppins e logos). Ficam em `apps/api/assets`,
 * fora de `src`, e são resolvidos a partir deste arquivo — funciona tanto em `src/`
 * (testes) quanto em `dist/` (produção), que têm a mesma profundidade.
 */
const ASSETS_DIR = join(__dirname, "..", "..", "..", "assets");

export const PRINT_FONT_FILES = {
  [PRINT_THEME.fonts.regular]: join(ASSETS_DIR, "fonts", "Poppins-Regular.ttf"),
  [PRINT_THEME.fonts.medium]: join(ASSETS_DIR, "fonts", "Poppins-Medium.ttf"),
  [PRINT_THEME.fonts.semibold]: join(ASSETS_DIR, "fonts", "Poppins-SemiBold.ttf"),
  [PRINT_THEME.fonts.bold]: join(ASSETS_DIR, "fonts", "Poppins-Bold.ttf"),
} as const;

export const PRINT_LOGOS = {
  /** Wordmark branco com detalhe ciano — para a faixa petróleo do cabeçalho. */
  white: join(ASSETS_DIR, "brand", "firmus-logo-white.png"),
  /** Wordmark petróleo — para fundos claros. */
  petrol: join(ASSETS_DIR, "brand", "firmus-logo-petrol.png"),
} as const;

interface FontRegistrar {
  registerFont(name: string, src: string): unknown;
}

/** Registra as 4 fontes Poppins no documento (pdfkit) para uso com `doc.font(PRINT_THEME.fonts.bold)`. */
export function registerPrintFonts(doc: FontRegistrar): void {
  for (const [name, file] of Object.entries(PRINT_FONT_FILES)) doc.registerFont(name, file);
}
