"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { RENOVATION_STAGES, RENOVATION_STAGE_LABELS, type RenovationTaskDto } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/renovation/task-card";

export function KanbanBoard({
  tasks,
  canManage,
  showProperty,
  hideCreateButton,
  onMove,
  onTaskClick,
  onCreateTask,
}: {
  tasks: RenovationTaskDto[];
  canManage: boolean;
  showProperty?: boolean;
  hideCreateButton?: boolean;
  onMove: (taskId: string, stage: (typeof RENOVATION_STAGES)[number], order: number) => void;
  onTaskClick: (task: RenovationTaskDto) => void;
  onCreateTask?: (stage: (typeof RENOVATION_STAGES)[number]) => void;
}) {
  const draggedTaskId = React.useRef<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const columns = RENOVATION_STAGES.map((stage) => ({
    stage,
    tasks: tasks.filter((task) => task.stage === stage),
  }));

  function handleDrop(stage: (typeof RENOVATION_STAGES)[number]) {
    if (!draggedTaskId.current) return;
    const column = columns.find((c) => c.stage === stage);
    const targetIndex = dragOverIndex ?? column?.tasks.length ?? 0;
    onMove(draggedTaskId.current, stage, targetIndex);
    draggedTaskId.current = null;
    setDragOverColumn(null);
    setDragOverIndex(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {columns.map((column) => (
        <div
          key={column.stage}
          className="flex w-full flex-col gap-2 rounded-lg bg-muted/40 p-3"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverColumn(column.stage);
            if (dragOverIndex === null) setDragOverIndex(column.tasks.length);
          }}
          onDragLeave={() => {
            if (dragOverColumn === column.stage) setDragOverColumn(null);
          }}
          onDrop={() => handleDrop(column.stage)}
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold">{RENOVATION_STAGE_LABELS[column.stage]}</h3>
            <span className="text-xs text-muted-foreground">{column.tasks.length}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {column.tasks.map((task, index) => (
              <div
                key={task.id}
                className="w-72"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverColumn(column.stage);
                  setDragOverIndex(index);
                }}
              >
                <TaskCard
                  task={task}
                  showProperty={showProperty}
                  onClick={() => onTaskClick(task)}
                  onDragStart={() => {
                    draggedTaskId.current = task.id;
                  }}
                />
              </div>
            ))}
          </div>

          {canManage && !hideCreateButton && onCreateTask && (
            <Button variant="ghost" size="sm" className="justify-start" onClick={() => onCreateTask(column.stage)}>
              <Plus className="size-3.5" />
              Novo cartão
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
