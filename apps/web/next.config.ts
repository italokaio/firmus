import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota só o necessário para rodar (sem devDependencies/monorepo inteiro)
  // — é o que o Dockerfile de produção copia para a imagem final. Só faz
  // sentido para o deploy self-hosted (Docker/VPS); na Vercel esse modo
  // conflita com o empacotamento automático dela (build falhava silenciosamente
  // em "onBuildComplete"), então é desativado quando `process.env.VERCEL` existe.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
