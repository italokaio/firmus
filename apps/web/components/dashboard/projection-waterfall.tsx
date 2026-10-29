"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Cascata da projeção: Avaliação Caixa − Custo incorrido − Custos até a venda = Resultado projetado.
 * Cada barra "flutua" sobre uma base transparente; realizado em ciano/petróleo, previsto em âmbar.
 */
export function ProjectionWaterfall({
  carteira,
}: {
  carteira: { avaliacao: string; custoIncorrido: string; custosAteVenda: string; resultadoProjetado: string };
}) {
  const avaliacao = Number(carteira.avaliacao);
  const custo = Number(carteira.custoIncorrido);
  const previsto = Number(carteira.custosAteVenda);
  const resultado = Number(carteira.resultadoProjetado);

  const data = [
    { name: "Avaliação Caixa", base: 0, value: avaliacao, shown: avaliacao, color: "var(--color-chart-1)" },
    { name: "Custo incorrido", base: Math.max(avaliacao - custo, 0), value: custo, shown: -custo, color: "var(--color-realized)" },
    {
      name: "Custos até a venda",
      base: Math.max(avaliacao - custo - previsto, 0),
      value: previsto,
      shown: -previsto,
      color: "var(--color-forecast)",
    },
    {
      name: "Resultado projetado",
      base: 0,
      value: Math.abs(resultado),
      shown: resultado,
      color: resultado < 0 ? "var(--color-negative)" : "var(--color-chart-2)",
    },
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} interval={0} />
          <YAxis
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickFormatter={(value: number) => `R$ ${compact.format(value)}`}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "var(--color-accent)", opacity: 0.4 }}
            formatter={(_value, _name, item) => [formatCurrency((item.payload as { shown: number }).shown), ""]}
            labelStyle={{ color: "var(--color-card-foreground)" }}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-card-foreground)",
            }}
          />
          <Bar dataKey="base" stackId="cascata" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="cascata" radius={[4, 4, 0, 0]}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
