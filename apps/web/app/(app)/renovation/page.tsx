"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PERMISSIONS, type PropertyDto, type RenovationStage, type RenovationTaskDto } from "@leilao-erp/types";
import { Select } from "@/components/ui/select";
import { KanbanBoard } from "@/components/renovation/kanban-board";
import { TaskDialog } from "@/components/renovation/task-dialog";
import { apiClient } from "@/lib/api/client";
import { usePermission } from "@/lib/hooks/use-permission";

export default function RenovationBoardPage() {
  const queryClient = useQueryClient();
  const canManage = usePermission(PERMISSIONS.RENOVATION_MANAGE);
  const [propertyFilter, setPropertyFilter] = React.useState("");
  const queryKey = ["renovation-board"] as const;

  const { data: tasks, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<RenovationTaskDto[]>("/renovation/board"),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties-lite"],
    queryFn: () => apiClient.get<PropertyDto[]>("/properties"),
  });

  const [selectedTask, setSelectedTask] = React.useState<RenovationTaskDto | null>(null);

  const moveTask = useMutation({
    mutationFn: ({ task, stage, order }: { task: RenovationTaskDto; stage: RenovationStage; order: number }) =>
      apiClient.patch(`/properties/${task.propertyId}/renovation/tasks/${task.id}/move`, { stage, order }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const filteredTasks = (tasks ?? []).filter(
    (task) => !propertyFilter || task.propertyId === propertyFilter,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reforma</h1>
          <p className="text-sm text-muted-foreground">Kanban de obras de todos os imóveis.</p>
        </div>
        <Select className="w-56" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
          <option value="">Todos os imóveis</option>
          {properties?.map((property) => (
            <option key={property.id} value={property.id}>
              {property.origem}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <KanbanBoard
          tasks={filteredTasks}
          canManage={canManage}
          showProperty
          hideCreateButton
          onMove={(taskId, stage, order) => {
            const task = filteredTasks.find((t) => t.id === taskId);
            if (task) moveTask.mutate({ task, stage, order });
          }}
          onTaskClick={(task) => setSelectedTask(task)}
        />
      )}

      {selectedTask && (
        <TaskDialog
          key={selectedTask.id}
          propertyId={selectedTask.propertyId}
          task={selectedTask}
          defaultStage={selectedTask.stage}
          open={Boolean(selectedTask)}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          canManage={canManage}
          queryKey={queryKey}
        />
      )}
    </div>
  );
}
