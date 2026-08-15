"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, FileText, Loader2, Send, Upload } from "lucide-react";
import {
  DUE_DILIGENCE_ITEM_TYPE_LABELS,
  DUE_DILIGENCE_STATUSES,
  DUE_DILIGENCE_STATUS_LABELS,
  type DueDiligenceItemDto,
  type DueDiligenceStatus,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatBytes, formatDate } from "@/lib/format";
import { uploadDueDiligenceFile } from "@/lib/hooks/use-property-upload";

interface CompanyUser {
  id: string;
  name: string;
}

export function DueDiligenceTab({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["due-diligence", propertyId],
    queryFn: () => apiClient.get<DueDiligenceItemDto[]>(`/properties/${propertyId}/due-diligence`),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<CompanyUser[]>("/users"),
    enabled: canManage,
  });

  const initialize = useMutation({
    mutationFn: () => apiClient.post(`/properties/${propertyId}/due-diligence/initialize`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["due-diligence", propertyId] }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum checklist iniciado</p>
            <p className="text-sm text-muted-foreground">
              Crie o checklist padrão de due diligence para começar a análise deste imóvel.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => initialize.mutate()} disabled={initialize.isPending}>
              {initialize.isPending && <Loader2 className="animate-spin" />}
              Iniciar checklist de due diligence
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const criticalPending = items.filter((item) => item.critical && item.status !== "CONCLUIDO").length;

  return (
    <div className="flex flex-col gap-4">
      {criticalPending > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {criticalPending} pendência(s) crítica(s) em aberto — a aquisição não poderá ser registrada até
          que sejam concluídas.
        </div>
      )}

      {items.map((item) => (
        <DueDiligenceItemCard
          key={item.id}
          item={item}
          propertyId={propertyId}
          canManage={canManage}
          users={users ?? []}
        />
      ))}
    </div>
  );
}

function DueDiligenceItemCard({
  item,
  propertyId,
  canManage,
  users,
}: {
  item: DueDiligenceItemDto;
  propertyId: string;
  canManage: boolean;
  users: CompanyUser[];
}) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["due-diligence", propertyId] });
  }

  const updateItem = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/properties/${propertyId}/due-diligence/${item.id}`, data),
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      apiClient.post(`/properties/${propertyId}/due-diligence/${item.id}/comments`, { body }),
    onSuccess: () => {
      setCommentBody("");
      return invalidate();
    },
  });

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadDueDiligenceFile(propertyId, item.id, file);
      await invalidate();
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{item.title}</CardTitle>
          <Badge variant="outline">{DUE_DILIGENCE_ITEM_TYPE_LABELS[item.type]}</Badge>
          {item.critical && <Badge variant="destructive">Crítico</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-40"
            value={item.status}
            disabled={!canManage || updateItem.isPending}
            onChange={(e) => updateItem.mutate({ status: e.target.value as DueDiligenceStatus })}
          >
            {DUE_DILIGENCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DUE_DILIGENCE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>

          <Select
            className="w-40"
            value={item.responsible?.id ?? ""}
            disabled={!canManage || updateItem.isPending}
            onChange={(e) => updateItem.mutate({ responsibleId: e.target.value || null })}
          >
            <option value="">Sem responsável</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            className="w-36"
            disabled={!canManage || updateItem.isPending}
            value={item.dueDate ? item.dueDate.slice(0, 10) : ""}
            onChange={(e) =>
              updateItem.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

        {item.files.length > 0 && (
          <div className="flex flex-col gap-1">
            {item.files.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="size-3.5" />
                {file.name}
                <span className="text-xs text-muted-foreground">({formatBytes(file.sizeBytes)})</span>
              </a>
            ))}
          </div>
        )}

        {canManage && (
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
            <Button
              size="sm"
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload />
              {isUploading ? "Enviando..." : "Anexar arquivo"}
            </Button>
          </div>
        )}

        {item.comments.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {item.comments.map((comment) => (
              <div key={comment.id} className="text-sm">
                <span className="font-medium">{comment.author?.name ?? "Usuário"}:</span>{" "}
                <span className="text-muted-foreground">{comment.body}</span>
                <span className="ml-2 text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Adicionar comentário..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentBody.trim()) addComment.mutate(commentBody.trim());
              }}
            />
            <Button
              size="icon"
              variant="outline"
              disabled={!commentBody.trim() || addComment.isPending}
              onClick={() => addComment.mutate(commentBody.trim())}
            >
              <Send className="size-4" />
            </Button>
          </div>
        )}

        {updateItem.isError && (
          <p className="text-xs text-destructive">
            {updateItem.error instanceof ApiError ? updateItem.error.message : "Erro ao atualizar item"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
