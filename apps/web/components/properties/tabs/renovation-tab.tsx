"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RenovationStage, RenovationTaskDto } from "@leilao-erp/types";
import { KanbanBoard } from "@/components/renovation/kanban-board";
import { TaskDialog } from "@/components/renovation/task-dialog";
import { apiClient } from "@/lib/api/client";

export function RenovationTab({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["renovation-tasks", propertyId] as const, [propertyId]);
  const [dialogState, setDialogState] = React.useState<
    | { open: false }
    | { open: true; task: RenovationTaskDto | null; defaultStage: RenovationStage }
  >({ open: false });

  const { data: tasks, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<RenovationTaskDto[]>(`/properties/${propertyId}/renovation/tasks`),
  });

  const moveTask = useMutation({
    mutationFn: ({ taskId, stage, order }: { taskId: string; stage: RenovationStage; order: number }) =>
      apiClient.patch(`/properties/${propertyId}/renovation/tasks/${taskId}/move`, { stage, order }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <>
      <KanbanBoard
        tasks={tasks ?? []}
        canManage={canManage}
        onMove={(taskId, stage, order) => moveTask.mutate({ taskId, stage, order })}
        onTaskClick={(task) => setDialogState({ open: true, task, defaultStage: task.stage })}
        onCreateTask={(stage) => setDialogState({ open: true, task: null, defaultStage: stage })}
      />

      {dialogState.open && (
        <TaskDialog
          key={dialogState.task?.id ?? `new-${dialogState.defaultStage}`}
          propertyId={propertyId}
          task={dialogState.task}
          defaultStage={dialogState.defaultStage}
          open={dialogState.open}
          onOpenChange={(open) => !open && setDialogState({ open: false })}
          canManage={canManage}
          queryKey={queryKey}
        />
      )}
    </>
  );
}
