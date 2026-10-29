"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  POST_ACQUISITION_STAGE_LABELS,
  NO_STAGE_LABEL,
  type PortfolioAcquiredRowDto,
} from "@leilao-erp/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { PriorityBadge } from "@/components/properties/status-badges";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";

type SortKey = "origem" | "etapa" | "diasEmCarteira" | "custoIncorrido" | "avaliacao" | "resultadoProjetado" | "margemPercentual";

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "origem", label: "Imóvel" },
  { key: "etapa", label: "Etapa" },
  { key: "diasEmCarteira", label: "Dias em carteira", numeric: true },
  { key: "custoIncorrido", label: "Custo incorrido", numeric: true },
  { key: "avaliacao", label: "Avaliação Caixa", numeric: true },
  { key: "resultadoProjetado", label: "Resultado projetado", numeric: true },
  { key: "margemPercentual", label: "Margem", numeric: true },
];

/** Valor comparável da coluna; nulos (sem avaliação / sem data) vão sempre para o fim. */
function sortValue(row: PortfolioAcquiredRowDto, key: SortKey): string | number | null {
  switch (key) {
    case "origem":
      return row.origem;
    case "etapa":
      return row.etapa ? POST_ACQUISITION_STAGE_LABELS[row.etapa] : null;
    case "diasEmCarteira":
      return row.diasEmCarteira;
    default: {
      const raw = row[key];
      return raw === null ? null : Number(raw);
    }
  }
}

export function AcquiredTable({ rows }: { rows: PortfolioAcquiredRowDto[] }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "origem", dir: "asc" });

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "pt-BR") * factor;
    });
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imóveis adquiridos</CardTitle>
        <CardDescription>Clique no cabeçalho para ordenar; clique no imóvel para abrir a ficha.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel adquirido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {COLUMNS.map((column) => {
                    const active = sort.key === column.key;
                    const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th key={column.key} className={cn("px-3 py-3 font-medium", column.numeric && "text-right")}>
                        <button
                          type="button"
                          onClick={() => toggle(column.key)}
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
                        >
                          {column.label}
                          <Icon className="size-3" />
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 font-medium">Prioridade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/40">
                    <td className="px-3 py-3">
                      <Link href={`/properties/${row.id}`} className="font-medium hover:underline">
                        {row.origem}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {row.etapa ? (
                        POST_ACQUISITION_STAGE_LABELS[row.etapa]
                      ) : (
                        <span className="text-muted-foreground">{NO_STAGE_LABEL}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">{row.diasEmCarteira ?? "—"}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(row.custoIncorrido)}</td>
                    <td className="px-3 py-3 text-right">
                      {row.semAvaliacao ? <StatusPill tone="info">Sem avaliação</StatusPill> : formatCurrency(row.avaliacao)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-medium",
                        row.resultadoProjetado !== null && Number(row.resultadoProjetado) < 0 && "text-negative",
                      )}
                    >
                      {row.resultadoProjetado === null ? "—" : formatCurrency(row.resultadoProjetado)}
                    </td>
                    <td className="px-3 py-3 text-right">{row.margemPercentual === null ? "—" : formatPercent(row.margemPercentual)}</td>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={row.prioridade} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
