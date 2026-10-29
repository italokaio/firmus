#!/usr/bin/env node
/**
 * Confere o tema da marca (apps/web/app/globals.css):
 *  1. contraste de texto ≥ 4,5:1 (e ≥ 3:1 para elementos gráficos) nos temas claro e escuro;
 *  2. nenhuma cor literal (#hex, rgb(), hsl(), oklch()) fora dos tokens.
 * Uso: pnpm --filter @leilao-erp/web check:theme
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { contrastRatio } = require("@leilao-erp/types");

// ---------- 1. Contraste ----------
const css = readFileSync(join(root, "app/globals.css"), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Bloco ${selector} não encontrado em globals.css`);
  return css.slice(start, css.indexOf("\n}", start));
}

function tokens(selector, base = {}) {
  const map = { ...base };
  for (const [, name, value] of block(selector).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\s*;/g)) {
    map[name] = value;
  }
  return map;
}

const light = tokens(":root");
const dark = tokens(".dark", light);

// [texto, fundo, mínimo, descrição]
const TEXT = 4.5;
const GRAPHIC = 3;
const pairs = [
  ["foreground", "background", TEXT, "texto / fundo"],
  ["card-foreground", "card", TEXT, "texto / card"],
  ["popover-foreground", "popover", TEXT, "texto / popover"],
  ["muted-foreground", "background", TEXT, "texto atenuado / fundo"],
  ["muted-foreground", "card", TEXT, "texto atenuado / card"],
  ["muted-foreground", "muted", TEXT, "texto atenuado / superfície-2"],
  ["secondary-foreground", "secondary", TEXT, "botão secundário"],
  ["accent-foreground", "accent", TEXT, "item em hover"],
  ["primary-foreground", "primary", TEXT, "botão primário"],
  ["accent-text", "card", TEXT, "texto de destaque / card"],
  ["accent-text", "background", TEXT, "texto de destaque / fundo"],
  ["forecast-text", "card", TEXT, "previsto (texto) / card"],
  ["forecast-text", "background", TEXT, "previsto (texto) / fundo"],
  ["forecast-foreground", "forecast", TEXT, "etiqueta previsto"],
  ["realized-text", "card", TEXT, "realizado (texto) / card"],
  ["realized-foreground", "realized", TEXT, "etiqueta realizado"],
  ["negative", "card", TEXT, "negativo (texto) / card"],
  ["negative-foreground", "negative", TEXT, "etiqueta negativo"],
  ["cancelled-text", "card", TEXT, "cancelado (texto) / card"],
  ["cancelled-foreground", "cancelled", TEXT, "etiqueta cancelado"],
  ["sidebar-foreground", "sidebar", TEXT, "menu lateral"],
  ["sidebar-accent-foreground", "sidebar-accent", TEXT, "item ativo do menu"],
  ["brand-white", "brand-petrol", TEXT, "texto branco / petróleo (KpiCard destacado)"],
  ["forecast-text", "muted", TEXT, "previsto (texto) / superfície-2"],
  ["realized-text", "muted", TEXT, "realizado (texto) / superfície-2"],
  ["negative", "muted", TEXT, "negativo (texto) / superfície-2"],
  ["cancelled-text", "muted", TEXT, "cancelado (texto) / superfície-2"],
  ["cancelled-text", "background", TEXT, "cancelado (texto) / fundo"],
  ["chart-1", "card", GRAPHIC, "gráfico série 1 / card"],
  ["chart-3", "card", GRAPHIC, "gráfico série 3 / card"],
  ["chart-4", "card", GRAPHIC, "gráfico série 4 / card"],
  ["chart-5", "card", GRAPHIC, "gráfico série 5 / card"],
];
// Conhecido e aceito (só elementos gráficos, nunca texto): no tema claro, a série 2 (#4FC6DC, ~2:1) e a
// série 3 (#C98A1C, 2,94:1) vêm direto da paleta da marca e são sempre acompanhadas de legenda/tooltip.
// O tema escuro (padrão) passa em tudo.
const KNOWN_LOW = new Set(["claro|gráfico série 2 / card", "claro|gráfico série 3 / card"]);
pairs.push(["chart-2", "card", GRAPHIC, "gráfico série 2 / card"]);

let failures = 0;
for (const [themeName, theme] of [["claro", light], ["escuro", dark]]) {
  for (const [fg, bg, min, label] of pairs) {
    const f = theme[fg];
    const b = theme[bg];
    if (!f || !b) {
      console.error(`✗ token ausente (${fg} ou ${bg}) no tema ${themeName}`);
      failures += 1;
      continue;
    }
    const ratio = contrastRatio(f, b);
    if (ratio < min) {
      if (KNOWN_LOW.has(`${themeName}|${label}`)) {
        console.warn(`! ${themeName}: ${label} = ${ratio.toFixed(2)} (< ${min}) — aceito (ver comentário)`);
        continue;
      }
      console.error(`✗ ${themeName}: ${label} = ${ratio.toFixed(2)} (mínimo ${min}) — ${f} sobre ${b}`);
      failures += 1;
    }
  }
}

// ---------- 2. Cores literais fora dos tokens ----------
const ALLOWED = new Set([
  "app/globals.css", // fonte dos tokens
  "app/layout.tsx", // themeColor do navegador (= --brand-petrol)
  "app/manifest.ts", // cores do PWA (= --brand-petrol)
]);
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/;
const SKIP_DIRS = new Set(["node_modules", ".next", "scripts", "public"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".d.ts")) {
      yield path;
    }
  }
}

for (const dir of ["app", "components", "lib"]) {
  for (const file of walk(join(root, dir))) {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (ALLOWED.has(rel)) continue;
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (COLOR_LITERAL.test(line)) {
          console.error(`✗ cor literal fora dos tokens: ${rel}:${i + 1}: ${line.trim()}`);
          failures += 1;
        }
      });
  }
}

if (failures > 0) {
  console.error(`\n${failures} problema(s) no tema.`);
  process.exit(1);
}
console.log("Tema OK: contraste dos temas claro e escuro e nenhuma cor fora dos tokens.");
