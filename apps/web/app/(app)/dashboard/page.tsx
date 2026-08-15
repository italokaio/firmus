"use client";

import { useQuery } from "@tanstack/react-query";
import { Home, Shield, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
  type FinanceSummaryDto,
  type Priority,
  type ProspectStatus,
} from "@leilao-erp/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatCurrency } from "@/lib/format";

interface DashboardSummary {
  usersCount: number;
  rolesCount: number;
  propertiesCount: number;
  propertiesByStatus: Array<{ status: ProspectStatus; count: number }>;
  propertiesByPriority: Array<{ prioridade: Priority; count: number }>;
  finance: FinanceSummaryDto;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  BAIXA: "var(--color-muted-foreground)",
  MEDIA: "var(--color-primary)",
  ALTA: "var(--color-warning)",
  URGENTE: "var(--color-destructive)",
};

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
  });

  const statusChartData = (data?.propertiesByStatus ?? []).map((row) => ({
    label: PROSPECT_STATUS_LABELS[row.status],
    count: row.count,
  }));
  const priorityChartData = (data?.propertiesByPriority ?? []).map((row) => ({
    label: PRIORITY_LABELS[row.prioridade],
    count: row.count,
    prioridade: row.prioridade,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu portfólio de leilões.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Imóveis em prospecção"
          value={isLoading ? "…" : String(data?.propertiesCount ?? 0)}
          icon={Home}
        />
        <StatCard
          label="Usuários ativos"
          value={isLoading ? "…" : String(data?.usersCount ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Papéis configurados"
          value={isLoading ? "…" : String(data?.rolesCount ?? 0)}
          icon={Shield}
        />
        <StatCard
          label="Saldo consolidado"
          value={isLoading ? "…" : formatCurrency(data?.finance.saldoConsolidado ?? "0")}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Receitas realizadas no mês"
          value={isLoading ? "…" : formatCurrency(data?.finance.totalReceitasMes ?? "0")}
          icon={Wallet}
        />
        <StatCard
          label="Despesas realizadas no mês"
          value={isLoading ? "…" : formatCurrency(data?.finance.totalDespesasMes ?? "0")}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Imóveis por status</CardTitle>
            <CardDescription>Distribuição do funil de prospecção atual.</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum imóvel cadastrado ainda.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-card-foreground)",
                      }}
                    />
                    <Bar dataKey="count" name="Imóveis" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imóveis por prioridade</CardTitle>
            <CardDescription>Onde a atenção deveria estar concentrada agora.</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum imóvel cadastrado ainda.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityChartData} margin={{ top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-card-foreground)",
                      }}
                    />
                    <Bar dataKey="count" name="Imóveis" radius={[4, 4, 0, 0]}>
                      {priorityChartData.map((row) => (
                        <Cell key={row.prioridade} fill={PRIORITY_COLORS[row.prioridade]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos módulos</CardTitle>
          <CardDescription>
            IA e notificações avançadas chegam na próxima fase, conforme o roadmap.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
