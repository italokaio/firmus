import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Firmus - Gestão Imobiliária",
    short_name: "Firmus",
    description: "Gestão completa de imóveis — leilão, venda direta e administração para terceiros",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#005666",
    theme_color: "#005666",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
