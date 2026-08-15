import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota só o necessário para rodar (sem devDependencies/monorepo inteiro)
  // — é o que o Dockerfile de produção copia para a imagem final.
  output: "standalone",
};

export default nextConfig;
