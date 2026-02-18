"use client";

import { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle } from "lucide-react";
import { cn, formatMinutes } from "@/lib/utils";
import { isBefore, parseISO } from "date-fns";

interface SuggestedTasksProps {
  tasks: Task[];
  date: string;
  onAdd: (taskId: string, day: string) => void;
}

export function SuggestedTasks({ tasks, date, onAdd }: SuggestedTasksProps) {
  if (tasks.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Suggested</h2>
      <div className="space-y-2 opacity-75">
        {tasks.map((task) => {
          const overdue = task.due_date && isBefore(parseISO(task.due_date), parseISO(date));
          return (
            <Card key={task.id} className={cn("flex items-center gap-3 p-3", overdue && "border-red-300")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                  <p className="text-sm">{task.name}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {task.estimated_minutes && (
                    <span className="text-xs text-muted-foreground">{formatMinutes(task.estimated_minutes)}</span>
                  )}
                  {task.due_date && (
                    <Badge variant={overdue ? "destructive" : "outline"} className="text-xs">
                      Due {task.due_date}
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAdd(task.id, date)}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
