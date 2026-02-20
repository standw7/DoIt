"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RecurringTask, DAY_NAMES } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";
import { Repeat, Trash2, ChevronDown, Pencil } from "lucide-react";
import { RecurringTaskDialog } from "./recurring-task-dialog";
import { RecurringTaskInsert } from "@/lib/types";
import { toast } from "sonner";

interface RecurringTasksSectionProps {
  recurringTasks: RecurringTask[];
  onCreate: (task: RecurringTaskInsert) => Promise<void>;
  onUpdate: (id: string, updates: Partial<RecurringTaskInsert>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function RecurringTasksSection({
  recurringTasks,
  onCreate,
  onUpdate,
  onDelete,
}: RecurringTasksSectionProps) {
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  async function handleToggleActive(task: RecurringTask) {
    try {
      await onUpdate(task.id, { active: !task.active });
    } catch {
      toast.error("Failed to update task");
    }
  }

  async function handleDelete(task: RecurringTask) {
    try {
      await onDelete(task.id);
      toast.success(`Deleted "${task.name}"`);
    } catch {
      toast.error("Failed to delete task");
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-left">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                <CardTitle className="flex items-center gap-2 text-base">
                  <Repeat className="h-4 w-4" />
                  Recurring Tasks
                </CardTitle>
              </button>
            </CollapsibleTrigger>
            <RecurringTaskDialog onCreate={onCreate} />
          </div>
          {isOpen && (
            <p className="text-xs text-muted-foreground">
              Tasks that automatically repeat on a weekly schedule
            </p>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {recurringTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recurring tasks yet
              </p>
            ) : (
              <div className="space-y-3">
                {recurringTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <Switch
                      checked={task.active}
                      onCheckedChange={() => handleToggleActive(task)}
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingTask(task)}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${!task.active ? "text-muted-foreground line-through" : ""}`}>
                          {task.name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {DAY_NAMES[task.recurrence_day]}s
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatMinutes(task.estimated_minutes)}
                        </Badge>
                      </div>
                      {task.end_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Until {task.end_date}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingTask(task)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(task)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>

        {editingTask && (
          <RecurringTaskDialog
            editingTask={editingTask}
            open={true}
            onOpenChange={(v) => { if (!v) setEditingTask(null); }}
            onUpdate={onUpdate}
          />
        )}
      </Card>
    </Collapsible>
  );
}
