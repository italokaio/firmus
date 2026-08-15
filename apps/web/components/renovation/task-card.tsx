import { CheckSquare, GripVertical, MessageSquare, Paperclip } from "lucide-react";
import type { RenovationTaskDto } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/properties/status-badges";
import { formatDate } from "@/lib/format";

export function TaskCard({
  task,
  onClick,
  onDragStart,
  showProperty,
}: {
  task: RenovationTaskDto;
  onClick: () => void;
  onDragStart: (event: React.DragEvent) => void;
  showProperty?: boolean;
}) {
  const doneItems = task.checklist.filter((item) => item.done).length;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-pointer gap-3 p-3 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
      </div>

      {showProperty && task.property && (
        <p className="truncate text-xs text-muted-foreground">{task.property.origem}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <Badge variant="outline" className="text-xs">
            {formatDate(task.dueDate)}
          </Badge>
        )}
      </div>

      {task.percentualConcluido > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${task.percentualConcluido}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{task.responsible?.name ?? "Sem responsável"}</span>
        <div className="flex items-center gap-2">
          {task.checklist.length > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare className="size-3" />
              {doneItems}/{task.checklist.length}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="size-3" />
              {task.comments.length}
            </span>
          )}
          {task.media.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="size-3" />
              {task.media.length}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
