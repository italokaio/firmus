"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  PERMISSIONS,
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  REPORT_TYPES,
  REPORT_TYPES_REQUIRING_PROPERTY,
  REPORT_TYPE_LABELS,
  type PropertyDto,
  type ReportDto,
  type ReportFormat,
  type ReportType,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";

export default function ReportsPage() {
  const canManage = usePermission(PERMISSIONS.REPORTS_MANAGE);
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<{ type: ReportType; format: ReportFormat; propertyId: string }>({
    type: "PORTFOLIO_SUMMARY",
    format: "PDF",
    propertyId: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiClient.get<ReportDto[]>("/reports"),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties-lite"],
    queryFn: () => apiClient.get<PropertyDto[]>("/properties"),
  });

  const requiresProperty = REPORT_TYPES_REQUIRING_PROPERTY.includes(form.type);

  const generate = useMutation({
    mutationFn: () =>
      apiClient.post("/reports", {
        type: form.type,
        format: form.format,
        propertyId: requiresProperty ? form.propertyId : undefined,
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao gerar relatório"),
  });

  const deleteReport = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reports/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exportação de dados do portfólio em PDF ou Excel.</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Gerar novo relatório</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Tipo</Label>
              <Select
                className="w-56"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as ReportType }))}
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {REPORT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Formato</Label>
              <Select
                className="w-32"
                value={form.format}
                onChange={(e) => setForm((prev) => ({ ...prev, format: e.target.value as ReportFormat }))}
              >
                {REPORT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {REPORT_FORMAT_LABELS[format]}
                  </option>
                ))}
              </Select>
            </div>
            {requiresProperty && (
              <div>
                <Label className="mb-1.5 block text-xs">Imóvel</Label>
                <Select
                  className="w-56"
                  value={form.propertyId}
                  onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                >
                  <option value="">Selecione…</option>
                  {properties?.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.origem}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button
              disabled={(requiresProperty && !form.propertyId) || generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Gerar relatório
            </Button>
          </CardContent>
          {error && <p className="px-6 pb-4 text-xs text-destructive">{error}</p>}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Relatórios gerados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : reports?.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum relatório gerado ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {reports?.map((report) => (
                <div key={report.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="flex items-center gap-3">
                    {report.format === "PDF" ? (
                      <FileText className="size-5 text-muted-foreground" />
                    ) : (
                      <FileSpreadsheet className="size-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{REPORT_TYPE_LABELS[report.type]}</span>
                        <Badge variant="outline">{report.format}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {report.property ? `${report.property.origem} · ` : ""}
                        {formatDate(report.createdAt)}
                        {report.generatedBy ? ` · por ${report.generatedBy.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={report.downloadUrl} target="_blank" rel="noreferrer">
                        <Download />
                        Baixar
                      </a>
                    </Button>
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => deleteReport.mutate(report.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
