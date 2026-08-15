"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  SIMULATOR_SCENARIO_TYPES,
  SIMULATOR_SCENARIO_TYPE_LABELS,
  type SimulatorOverviewDto,
  type SimulatorScenarioDto,
  type SimulatorScenarioType,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";

type FormState = {
  capitalInvestido: string;
  valorVendaEstimado: string;
  custosVenda: string;
  prazoMeses: string;
  taxaDescontoAnual: string;
  observacoes: string;
};

export function SimulatorPanel({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["simulator", propertyId] as const, [propertyId]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<SimulatorOverviewDto>(`/properties/${propertyId}/simulator`),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  const upsertScenario = useMutation({
    mutationFn: ({ tipo, form }: { tipo: SimulatorScenarioType; form: FormState }) =>
      apiClient.put(`/properties/${propertyId}/simulator/scenarios/${tipo}`, {
        capitalInvestido: form.capitalInvestido,
        valorVendaEstimado: form.valorVendaEstimado,
        custosVenda: form.custosVenda,
        prazoMeses: Number(form.prazoMeses),
        taxaDescontoAnual: form.taxaDescontoAnual,
        observacoes: form.observacoes || undefined,
      }),
    onSuccess: invalidate,
  });

  const deleteScenario = useMutation({
    mutationFn: (tipo: SimulatorScenarioType) =>
      apiClient.delete(`/properties/${propertyId}/simulator/scenarios/${tipo}`),
    onSuccess: invalidate,
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {SIMULATOR_SCENARIO_TYPES.map((tipo) => (
        <ScenarioCard
          key={data.scenarios.find((s) => s.tipo === tipo)?.id ?? tipo}
          tipo={tipo}
          scenario={data.scenarios.find((s) => s.tipo === tipo) ?? null}
          suggestedInputs={data.suggestedInputs}
          canManage={canManage}
          onSave={(form) => upsertScenario.mutate({ tipo, form })}
          onDelete={() => deleteScenario.mutate(tipo)}
          isSaving={upsertScenario.isPending}
        />
      ))}
    </div>
  );
}

function ScenarioCard({
  tipo,
  scenario,
  suggestedInputs,
  canManage,
  onSave,
  onDelete,
  isSaving,
}: {
  tipo: SimulatorScenarioType;
  scenario: SimulatorScenarioDto | null;
  suggestedInputs: SimulatorOverviewDto["suggestedInputs"];
  canManage: boolean;
  onSave: (form: FormState) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = React.useState<FormState>(() => toFormState(scenario, suggestedInputs));

  function useSuggestion() {
    setForm((prev) => ({ ...prev, capitalInvestido: suggestedInputs.capitalInvestidoSugerido }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{SIMULATOR_SCENARIO_TYPE_LABELS[tipo]}</CardTitle>
        {canManage && scenario && (
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs">Capital investido (R$)</Label>
            {canManage && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={useSuggestion}
              >
                <Sparkles className="size-3" />
                Usar sugestão ({formatCurrency(suggestedInputs.capitalInvestidoSugerido)})
              </button>
            )}
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.capitalInvestido}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, capitalInvestido: e.target.value }))}
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">Valor de venda estimado (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.valorVendaEstimado}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, valorVendaEstimado: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block text-xs">Custos de venda (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.custosVenda}
              disabled={!canManage}
              onChange={(e) => setForm((prev) => ({ ...prev, custosVenda: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Prazo (meses)</Label>
            <Input
              type="number"
              min="1"
              max="240"
              value={form.prazoMeses}
              disabled={!canManage}
              onChange={(e) => setForm((prev) => ({ ...prev, prazoMeses: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">Taxa de desconto anual (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.taxaDescontoAnual}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, taxaDescontoAnual: e.target.value }))}
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">Observações</Label>
          <Textarea
            rows={2}
            value={form.observacoes}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
          />
        </div>

        {canManage && (
          <Button
            disabled={!form.capitalInvestido || !form.valorVendaEstimado || !form.prazoMeses || isSaving}
            onClick={() => onSave(form)}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            {scenario ? "Salvar cenário" : "Criar cenário"}
          </Button>
        )}

        {scenario && (
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <Metric label="Lucro bruto" value={formatCurrency(scenario.lucroBruto)} />
            <Metric label="ROI" value={`${scenario.roi}%`} />
            <Metric label="Margem" value={scenario.margem ? `${scenario.margem}%` : "—"} />
            <Metric
              label="Payback"
              value={scenario.paybackMeses !== null ? `${scenario.paybackMeses} meses` : "Não recupera"}
            />
            <Metric label="TIR anual" value={scenario.tirAnual ? `${scenario.tirAnual}%` : "—"} />
            <Metric label="VPL" value={formatCurrency(scenario.vpl)} />
          </div>
        )}

        {!scenario && <Badge variant="outline">Cenário ainda não criado</Badge>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function toFormState(
  scenario: SimulatorScenarioDto | null,
  suggestedInputs: SimulatorOverviewDto["suggestedInputs"],
): FormState {
  return {
    capitalInvestido: scenario?.capitalInvestido ?? suggestedInputs.capitalInvestidoSugerido,
    valorVendaEstimado: scenario?.valorVendaEstimado ?? suggestedInputs.valorAvaliacaoImovel,
    custosVenda: scenario?.custosVenda ?? "0",
    prazoMeses: scenario ? String(scenario.prazoMeses) : "6",
    taxaDescontoAnual: scenario?.taxaDescontoAnual ?? "12",
    observacoes: scenario?.observacoes ?? "",
  };
}
