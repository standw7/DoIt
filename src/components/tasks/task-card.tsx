"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, CalendarPlus } from "lucide-react";
import { Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail-dialog";

interface TaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAssignToDay?: (taskId: string) => void;
}

const priorityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

export function TaskCard({ task, onToggleDone, onUpdate, onDelete, onAssignToDay }: TaskCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isDone = task.status === "done";

  return (
    <>
      <Card className={cn("flex items-start gap-3 p-3", isDone && "opacity-60")}>
        <Checkbox
          checked={isDone}
          onCheckedChange={() => onToggleDone(task)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailOpen(true)}>
          <p className={cn("text-sm font-medium", isDone && "line-through")}>{task.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.estimated_minutes && (
              <span className="text-xs text-muted-foreground">{formatMinutes(task.estimated_minutes)}</span>
            )}
            {task.priority !== "medium" && (
              <span className={cn("text-xs font-medium", priorityColors[task.priority])}>
                {task.priority}
              </span>
            )}
            {task.due_date && (
              <Badge variant="outline" className="text-xs">{task.due_date}</Badge>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAssignToDay && (
              <DropdownMenuItem onClick={() => onAssignToDay(task.id)}>
                <CalendarPlus className="h-4 w-4 mr-2" /> Add to today
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
      <TaskDetailDialog
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
