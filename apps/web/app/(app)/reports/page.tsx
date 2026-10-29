"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  EMPRESA_ORIGEM_LABEL,
  ORIGEM_NAO_INFORMADA_LABEL,
  PERMISSIONS,
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  REPORT_TYPES,
  REPORT_TYPES_REQUIRING_INVESTOR,
  REPORT_TYPES_REQUIRING_PROPERTY,
  REPORT_TYPES_WITH_OPTIONAL_PROPERTY,
  REPORT_TYPES_WITH_PERIOD,
  REPORT_TYPE_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  type FinanceAccountDto,
  type FinanceCategoryDto,
  type InvestorDto,
  type PropertyDto,
  type ReportDto,
  type ReportFormat,
  type ReportType,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";

interface ReportForm {
  type: ReportType;
  format: ReportFormat;
  propertyId: string;
  investorId: string;
  from: string;
  to: string;
  accountId: string;
  categoryId: string;
  status: string;
  origem: string;
}

const EMPTY_FORM: ReportForm = {
  type: "PORTFOLIO_SUMMARY",
  format: "PDF",
  propertyId: "",
  investorId: "",
  from: "",
  to: "",
  accountId: "",
  categoryId: "",
  status: "",
  origem: "",
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const canManage = usePermission(PERMISSIONS.REPORTS_MANAGE);
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<ReportForm>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof ReportForm>(key: K, value: ReportForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const requiresProperty = REPORT_TYPES_REQUIRING_PROPERTY.includes(form.type);
  const requiresInvestor = REPORT_TYPES_REQUIRING_INVESTOR.includes(form.type);
  const optionalProperty = REPORT_TYPES_WITH_OPTIONAL_PROPERTY.includes(form.type);
  const withPeriod = REPORT_TYPES_WITH_PERIOD.includes(form.type);
  const isStatement = form.type === "TRANSACTION_STATEMENT";

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiClient.get<ReportDto[]>("/reports"),
  });
  const { data: properties } = useQuery({
    queryKey: ["properties-lite"],
    queryFn: () => apiClient.get<PropertyDto[]>("/properties"),
  });
  // Quem não tem permissão para estas listas segue só com os filtros que consegue preencher.
  const { data: investors } = useQuery({
    queryKey: ["investors-for-origin"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
    enabled: canManage && (requiresInvestor || isStatement),
    retry: false,
  });
  const { data: categories } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: () => apiClient.get<FinanceCategoryDto[]>("/finance/categories"),
    enabled: canManage && isStatement,
    retry: false,
  });
  const { data: accounts } = useQuery({
    queryKey: ["finance-accounts-lite"],
    queryFn: () => apiClient.get<FinanceAccountDto[]>("/finance/accounts"),
    enabled: canManage && isStatement,
    retry: false,
  });

  const periodInvalid = withPeriod && form.from !== "" && form.to !== "" && form.from > form.to;
  const missingRequired =
    (requiresProperty && !form.propertyId) || (requiresInvestor && !form.investorId) || periodInvalid;

  const generate = useMutation({
    mutationFn: () => {
      // Só envia o que faz sentido para o tipo escolhido (campos vazios saem do corpo).
      const body: Record<string, unknown> = { type: form.type, format: form.format };
      if (requiresProperty || optionalProperty) body.propertyId = form.propertyId || undefined;
      if (requiresInvestor) body.investorId = form.investorId;
      if (withPeriod) {
        body.from = form.from || undefined;
        body.to = form.to || undefined;
      }
      if (isStatement) {
        body.accountId = form.accountId || undefined;
        body.categoryId = form.categoryId || undefined;
        body.status = form.status || undefined;
        body.origem = form.origem || undefined;
      }
      return apiClient.post("/reports", body);
    },
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

  const propertySelect = (required: boolean) => (
    <Field label={required ? "Imóvel" : "Imóvel (opcional)"}>
      <Select className="w-60" value={form.propertyId} onChange={(e) => set("propertyId", e.target.value)}>
        <option value="">{required ? "Selecione…" : "Todos os imóveis"}</option>
        {properties?.map((property) => (
          <option key={property.id} value={property.id}>
            {property.origem}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exportação de dados do portfólio em PDF ou Excel, com a identidade da Firmus.</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Gerar novo relatório</CardTitle>
            <CardDescription>Os filtros mudam conforme o tipo escolhido.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Field label="Tipo">
              <Select className="w-64" value={form.type} onChange={(e) => set("type", e.target.value as ReportType)}>
                {REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {REPORT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select className="w-32" value={form.format} onChange={(e) => set("format", e.target.value as ReportFormat)}>
                {REPORT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {REPORT_FORMAT_LABELS[format]}
                  </option>
                ))}
              </Select>
            </Field>

            {requiresInvestor && (
              <Field label="Investidor">
                <Select className="w-60" value={form.investorId} onChange={(e) => set("investorId", e.target.value)}>
                  <option value="">Selecione…</option>
                  {investors?.map((investor) => (
                    <option key={investor.id} value={investor.id}>
                      {investor.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {requiresProperty && propertySelect(true)}
            {optionalProperty && propertySelect(false)}

            {withPeriod && (
              <>
                <Field label="De">
                  <Input type="date" className="w-40" value={form.from} onChange={(e) => set("from", e.target.value)} />
                </Field>
                <Field label="Até">
                  <Input type="date" className="w-40" value={form.to} onChange={(e) => set("to", e.target.value)} />
                </Field>
              </>
            )}

            {isStatement && (
              <>
                <Field label="Conta de caixa">
                  <Select className="w-52" value={form.accountId} onChange={(e) => set("accountId", e.target.value)}>
                    <option value="">Todas as contas</option>
                    {accounts?.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Categoria">
                  <Select className="w-48" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                    <option value="">Todas</option>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name.trim()}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select className="w-36" value={form.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="">Todos</option>
                    {TRANSACTION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TRANSACTION_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Pago por">
                  <Select className="w-48" value={form.origem} onChange={(e) => set("origem", e.target.value)}>
                    <option value="">Todos</option>
                    <option value="EMPRESA">{EMPRESA_ORIGEM_LABEL}</option>
                    <option value="NAO_INFORMADO">{ORIGEM_NAO_INFORMADA_LABEL}</option>
                    {investors?.map((investor) => (
                      <option key={investor.id} value={investor.id}>
                        {investor.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}

            <Button disabled={missingRequired || generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Gerar relatório
            </Button>
          </CardContent>
          {periodInvalid && <p className="px-6 pb-4 text-xs text-destructive">A data final deve ser igual ou posterior à inicial.</p>}
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
                        {report.filters?.contexto ? `${report.filters.contexto} · ` : ""}
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
