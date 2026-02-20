"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, X, CalendarPlus, CalendarMinus, Clock, Pencil } from "lucide-react";
import { Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail-dialog";

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAssignToDay?: (taskId: string) => void;
  onUnschedule?: (task: Task) => void;
  projects?: ProjectOption[];
  scheduledTime?: string;
}

const priorityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

export function TaskCard({ task, onToggleDone, onUpdate, onDelete, onAssignToDay, onUnschedule, projects, scheduledTime }: TaskCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isDone = task.status === "done";

  return (
    <>
      <Card className={cn("relative flex items-start gap-3 p-3 pr-20 md:pr-16", isDone && "opacity-60")}>
        <div className="absolute right-1 top-1 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setDetailOpen(true)}
          >
            <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-red-500"
            onClick={() => onDelete(task.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Checkbox
          checked={isDone}
          onCheckedChange={() => onToggleDone(task)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailOpen(true)}>
          <p className={cn("text-sm font-medium", isDone && "line-through")}>{task.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {scheduledTime && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {scheduledTime}
              </span>
            )}
            {task.estimated_minutes && (
              <span className="text-xs text-muted-foreground">{formatMinutes(task.estimated_minutes)}</span>
            )}
            {task.priority !== "medium" && (
              <span className={cn("text-xs font-medium", priorityColors[task.priority])}>
                {task.priority}
              </span>
            )}
            {task.auto_assigned && (
              <Badge variant="secondary" className="text-xs">auto</Badge>
            )}
            {task.due_date && (
              <Badge variant="outline" className="text-xs">{task.due_date}</Badge>
            )}
          </div>
        </div>
        {(onAssignToDay || (onUnschedule && task.google_event_id)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 md:h-8 md:w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onAssignToDay && (
                <DropdownMenuItem onClick={() => onAssignToDay(task.id)}>
                  <CalendarPlus className="h-4 w-4 mr-2" /> Add to today
                </DropdownMenuItem>
              )}
              {onUnschedule && task.google_event_id && (
                <DropdownMenuItem onClick={() => onUnschedule(task)}>
                  <CalendarMinus className="h-4 w-4 mr-2" /> Remove from calendar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Card>
      <TaskDetailDialog
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={onUpdate}
        onDelete={onDelete}
        projects={projects}
      />
    </>
  );
}
