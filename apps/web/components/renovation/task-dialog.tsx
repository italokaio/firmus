"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Loader2, Plus, Send, Square, Upload } from "lucide-react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  RENOVATION_STAGE_LABELS,
  RENOVATION_STAGES,
  type Priority,
  type RenovationStage,
  type RenovationTaskDto,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { uploadRenovationMedia } from "@/lib/hooks/use-property-upload";

interface CompanyUser {
  id: string;
  name: string;
}

export function TaskDialog({
  propertyId,
  task,
  defaultStage,
  open,
  onOpenChange,
  canManage,
  queryKey,
}: {
  propertyId: string;
  task: RenovationTaskDto | null;
  defaultStage: RenovationStage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(task);

  // Sem efeito para ressincronizar: o componente pai monta este dialog com uma
  // `key` derivada do cartão (ver renovation-tab.tsx / renovation/page.tsx),
  // então o React já remonta e recalcula este estado inicial ao trocar de cartão.
  const [form, setForm] = React.useState(() => toFormState(task, defaultStage));

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<CompanyUser[]>("/users"),
    enabled: canManage,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  const createTask = useMutation({
    mutationFn: () =>
      apiClient.post(`/properties/${propertyId}/renovation/tasks`, {
        title: form.title,
        description: form.description || undefined,
        stage: form.stage,
        priority: form.priority,
        responsibleId: form.responsibleId || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        valorPrevisto: form.valorPrevisto || "0",
        dependsOnTaskIds: [],
      }),
    onSuccess: async () => {
      await invalidate();
      onOpenChange(false);
    },
  });

  const updateTask = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/properties/${propertyId}/renovation/tasks/${task!.id}`, data),
    onSuccess: invalidate,
  });

  const addChecklistItem = useMutation({
    mutationFn: (title: string) =>
      apiClient.post(`/properties/${propertyId}/renovation/tasks/${task!.id}/checklist`, { title }),
    onSuccess: invalidate,
  });

  const toggleChecklistItem = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      apiClient.patch(`/properties/${propertyId}/renovation/tasks/${task!.id}/checklist/${itemId}`, { done }),
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      apiClient.post(`/properties/${propertyId}/renovation/tasks/${task!.id}/comments`, { body }),
    onSuccess: invalidate,
  });

  const [newChecklistTitle, setNewChecklistTitle] = React.useState("");
  const [newComment, setNewComment] = React.useState("");
  const mediaInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingMedia, setIsUploadingMedia] = React.useState(false);

  async function handleMediaSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !task) return;
    setIsUploadingMedia(true);
    try {
      await uploadRenovationMedia(propertyId, task.id, file);
      await invalidate();
    } finally {
      setIsUploadingMedia(false);
    }
  }

  function handleFieldBlur(field: string, value: unknown) {
    if (isEditing) updateTask.mutate({ [field]: value });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? task!.title : "Novo cartão"}</DialogTitle>
          <DialogDescription>
            {isEditing ? RENOVATION_STAGE_LABELS[task!.stage] : RENOVATION_STAGE_LABELS[defaultStage]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block">Título</Label>
            <Input
              value={form.title}
              disabled={!canManage}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              onBlur={(e) => handleFieldBlur("title", e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Descrição</Label>
            <Textarea
              rows={2}
              value={form.description}
              disabled={!canManage}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              onBlur={(e) => handleFieldBlur("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {isEditing && (
              <div>
                <Label className="mb-1.5 block text-xs">Etapa</Label>
                <Select
                  value={task!.stage}
                  disabled={!canManage}
                  onChange={(e) =>
                    updateTask.mutate({ stage: e.target.value }) /* fallback: também move via drag no board */
                  }
                >
                  {RENOVATION_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {RENOVATION_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block text-xs">Prioridade</Label>
              <Select
                value={form.priority}
                disabled={!canManage}
                onChange={(e) => {
                  const priority = e.target.value as Priority;
                  setForm((prev) => ({ ...prev, priority }));
                  handleFieldBlur("priority", priority);
                }}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Responsável</Label>
              <Select
                value={form.responsibleId}
                disabled={!canManage}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, responsibleId: e.target.value }));
                  handleFieldBlur("responsibleId", e.target.value || null);
                }}
              >
                <option value="">Sem responsável</option>
                {users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Prazo</Label>
              <Input
                type="date"
                value={form.dueDate}
                disabled={!canManage}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                onBlur={(e) =>
                  handleFieldBlur("dueDate", e.target.value ? new Date(e.target.value).toISOString() : null)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs">Valor previsto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valorPrevisto}
                disabled={!canManage}
                onChange={(e) => setForm((prev) => ({ ...prev, valorPrevisto: e.target.value }))}
                onBlur={(e) => handleFieldBlur("valorPrevisto", e.target.value)}
              />
            </div>
            {isEditing && (
              <>
                <div>
                  <Label className="mb-1.5 block text-xs">Valor realizado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={task!.valorRealizado}
                    disabled={!canManage}
                    onBlur={(e) => handleFieldBlur("valorRealizado", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">% concluído</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={task!.percentualConcluido}
                    disabled={!canManage}
                    onBlur={(e) => handleFieldBlur("percentualConcluido", Number(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>

          {!isEditing && (
            <Button disabled={!form.title || createTask.isPending} onClick={() => createTask.mutate()}>
              {createTask.isPending && <Loader2 className="animate-spin" />}
              Criar cartão
            </Button>
          )}

          {isEditing && (
            <>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">
                  Checklist ({task!.checklist.filter((i) => i.done).length}/{task!.checklist.length})
                </p>
                <div className="flex flex-col gap-1">
                  {task!.checklist.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!canManage}
                      className="flex items-center gap-2 text-left text-sm"
                      onClick={() => toggleChecklistItem.mutate({ itemId: item.id, done: !item.done })}
                    >
                      {item.done ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4 text-muted-foreground" />
                      )}
                      <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.title}</span>
                    </button>
                  ))}
                </div>
                {canManage && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Novo item do checklist..."
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newChecklistTitle.trim()) {
                          addChecklistItem.mutate(newChecklistTitle.trim());
                          setNewChecklistTitle("");
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        if (newChecklistTitle.trim()) {
                          addChecklistItem.mutate(newChecklistTitle.trim());
                          setNewChecklistTitle("");
                        }
                      }}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Mídia ({task!.media.length})</p>
                <div className="mb-2 grid grid-cols-4 gap-2">
                  {task!.media.map((media) => (
                    <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="block">
                      {media.kind === "FOTO" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL pré-assinada temporária
                        <img src={media.url} alt="" className="aspect-square w-full rounded-md object-cover" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
                          Vídeo
                        </div>
                      )}
                    </a>
                  ))}
                </div>
                {canManage && (
                  <>
                    <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelected} />
                    <Button size="sm" variant="outline" disabled={isUploadingMedia} onClick={() => mediaInputRef.current?.click()}>
                      <Upload />
                      {isUploadingMedia ? "Enviando..." : "Adicionar foto/vídeo"}
                    </Button>
                  </>
                )}
              </div>

              {task!.dependsOn.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-medium">Depende de</p>
                  <div className="flex flex-wrap gap-2">
                    {task!.dependsOn.map(({ dependsOn }) => (
                      <Badge key={dependsOn.id} variant="outline">
                        {dependsOn.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Comentários</p>
                <div className="flex flex-col gap-2">
                  {task!.comments.map((comment) => (
                    <div key={comment.id} className="text-sm">
                      <span className="font-medium">{comment.author?.name ?? "Usuário"}:</span>{" "}
                      <span className="text-muted-foreground">{comment.body}</span>
                    </div>
                  ))}
                </div>
                {canManage && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Adicionar comentário..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newComment.trim()) {
                          addComment.mutate(newComment.trim());
                          setNewComment("");
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        if (newComment.trim()) {
                          addComment.mutate(newComment.trim());
                          setNewComment("");
                        }
                      }}
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Valor previsto: {formatCurrency(form.valorPrevisto)} · Valor realizado:{" "}
                {formatCurrency(task!.valorRealizado)}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toFormState(task: RenovationTaskDto | null, defaultStage: RenovationStage) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    stage: task?.stage ?? defaultStage,
    priority: task?.priority ?? "MEDIA",
    responsibleId: task?.responsible?.id ?? "",
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
    valorPrevisto: task?.valorPrevisto ?? "0",
  };
}
