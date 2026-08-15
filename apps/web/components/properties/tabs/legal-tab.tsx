"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, Loader2, Plus, Upload } from "lucide-react";
import {
  LEGAL_CASE_STATUS_LABELS,
  LEGAL_CASE_STATUSES,
  LEGAL_EVENT_TYPE_LABELS,
  LEGAL_EVENT_TYPES,
  type LegalCaseDto,
  type LegalEventType,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { formatBytes, formatCurrency, formatDate } from "@/lib/format";
import { uploadLegalDocument } from "@/lib/hooks/use-property-upload";

export function LegalTab({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [newEvent, setNewEvent] = React.useState<{ type: LegalEventType; title: string; dueDate: string }>({
    type: "PRAZO",
    title: "",
    dueDate: "",
  });

  const { data: legalCase, isLoading } = useQuery({
    queryKey: ["legal-case", propertyId],
    queryFn: () => apiClient.get<LegalCaseDto | null>(`/properties/${propertyId}/legal`),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["legal-case", propertyId] });
  }

  const updateCase = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.patch(`/properties/${propertyId}/legal`, data),
    onSuccess: invalidate,
  });

  const updateEvent = useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: Record<string, unknown> }) =>
      apiClient.patch(`/properties/${propertyId}/legal/events/${eventId}`, data),
    onSuccess: invalidate,
  });

  const addEvent = useMutation({
    mutationFn: () =>
      apiClient.post(`/properties/${propertyId}/legal/events`, {
        ...newEvent,
        dueDate: new Date(newEvent.dueDate).toISOString(),
      }),
    onSuccess: () => {
      setNewEvent({ type: "PRAZO", title: "", dueDate: "" });
      return invalidate();
    },
  });

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadLegalDocument(propertyId, file);
      await invalidate();
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!legalCase) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          O processo jurídico é criado automaticamente ao registrar a aquisição do imóvel.
        </CardContent>
      </Card>
    );
  }

  const overdueCount = legalCase.events.filter((event) => event.overdue).length;

  return (
    <div className="flex flex-col gap-4">
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {overdueCount} prazo(s)/audiência(s) vencido(s) e ainda pendente(s).
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Processo jurídico</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">Status</Label>
            <Select
              value={legalCase.status}
              disabled={!canManage}
              onChange={(e) => updateCase.mutate({ status: e.target.value })}
            >
              {LEGAL_CASE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEGAL_CASE_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Advogado responsável</Label>
            <Input
              defaultValue={legalCase.advogadoResponsavel ?? ""}
              disabled={!canManage}
              onBlur={(e) => updateCase.mutate({ advogadoResponsavel: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Custas processuais (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              defaultValue={legalCase.custasProcessuais}
              disabled={!canManage}
              onBlur={(e) => updateCase.mutate({ custasProcessuais: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Total atual: {formatCurrency(legalCase.custasProcessuais)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">Observações</Label>
            <Textarea
              rows={3}
              defaultValue={legalCase.observacoes ?? ""}
              disabled={!canManage}
              onBlur={(e) => updateCase.mutate({ observacoes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prazos & audiências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {legalCase.events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{LEGAL_EVENT_TYPE_LABELS[event.type]}</Badge>
                  <span className="text-sm font-medium">{event.title}</span>
                  {event.overdue && <Badge variant="destructive">Vencido</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(event.dueDate)}</p>
              </div>
              {canManage && (
                <Select
                  className="w-36"
                  value={event.status}
                  onChange={(e) =>
                    updateEvent.mutate({ eventId: event.id, data: { status: e.target.value } })
                  }
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="CONCLUIDO">Concluído</option>
                </Select>
              )}
            </div>
          ))}
          {legalCase.events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum prazo ou audiência cadastrado.</p>
          )}

          {canManage && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div>
                <Label className="mb-1.5 block text-xs">Tipo</Label>
                <Select
                  className="w-32"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, type: e.target.value as LegalEventType }))}
                >
                  {LEGAL_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {LEGAL_EVENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs">Título</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Data</Label>
                <Input
                  type="date"
                  value={newEvent.dueDate}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <Button
                disabled={!newEvent.title || !newEvent.dueDate || addEvent.isPending}
                onClick={() => addEvent.mutate()}
              >
                {addEvent.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Adicionar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documentos</CardTitle>
          {canManage && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <Button size="sm" variant="outline" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                <Upload />
                {isUploading ? "Enviando..." : "Adicionar documento"}
              </Button>
            </>
          )}
        </CardHeader>
        <CardContent>
          {legalCase.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {legalCase.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{document.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(document.sizeBytes)} · {formatDate(document.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={document.url} target="_blank" rel="noreferrer">
                      <Download />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
