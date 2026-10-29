import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

// Poppins não é uma fonte variável: os pesos usados no app precisam ser listados.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Firmus - Gestão Imobiliária",
  description: "Gestão completa de imóveis — leilão, venda direta e administração para terceiros",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Firmus",
  },
};

export const viewport: Viewport = {
  themeColor: "#005666",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} h-full font-sans antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
