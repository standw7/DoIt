"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ChevronDown } from "lucide-react";
import { TaskInsert, TaskPriority, Task, CalendarEvent } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { pickBestDay } from "@/lib/scheduler";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateTaskDialogProps {
  projectId?: string;
  day?: string;
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  onCreate: (task: TaskInsert) => Promise<void>;
}

const TIME_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
];

export function CreateTaskDialog({
  projectId,
  day: prefillDay,
  existingTasks,
  calendarEvents,
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  onCreate,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [day, setDay] = useState(prefillDay ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  function reset() {
    setName("");
    setDueDate("");
    setDay(prefillDay ?? "");
    setEstimatedMinutes(null);
    setCustomMinutes("");
    setPriority("medium");
    setDescription("");
    setShowDetails(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = customMinutes ? parseInt(customMinutes) : estimatedMinutes;
    if (!name.trim() || !dueDate || !minutes) return;

    let assignedDay = day || null;
    let autoAssigned = false;

    if (!assignedDay) {
      assignedDay = pickBestDay({
        task: { estimated_minutes: minutes, due_date: dueDate, priority },
        existingTasks,
        calendarEvents,
        workingHoursStart,
        workingHoursEnd,
        dailyBudget,
      });
      autoAssigned = true;
    }

    try {
      await onCreate({
        name: name.trim(),
        project_id: projectId ?? null,
        day: assignedDay,
        status: "planned",
        priority,
        description: description.trim() || null,
        estimated_minutes: minutes,
        due_date: dueDate,
        split_allowed: false,
        tags: null,
        sort_order: 0,
        google_event_id: null,
        auto_assigned: autoAssigned,
      });
      reset();
      setOpen(false);
      toast.success(autoAssigned ? `Task auto-assigned to ${assignedDay}` : "Task created");
    } catch {
      toast.error("Failed to create task");
    }
  }

  const minutes = customMinutes ? parseInt(customMinutes) : estimatedMinutes;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground">
          <Plus className="h-4 w-4 mr-2" /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What needs to be done?"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div>
            <Label>Due date *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Estimated time *</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {TIME_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={estimatedMinutes === preset.value && !customMinutes ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setEstimatedMinutes(preset.value); setCustomMinutes(""); }}
                >
                  {preset.label}
                </Button>
              ))}
              <Input
                type="number"
                placeholder="Custom"
                className="w-20"
                value={customMinutes}
                onChange={(e) => {
                  setCustomMinutes(e.target.value);
                  if (e.target.value) setEstimatedMinutes(parseInt(e.target.value));
                }}
                min={5}
                max={480}
              />
            </div>
          </div>

          <div>
            <Label>Priority</Label>
            <div className="flex gap-2 mt-1">
              {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(p)}
                  className={cn(
                    priority === p && p === "high" && "bg-red-500 hover:bg-red-600",
                    priority === p && p === "low" && "bg-blue-500 hover:bg-blue-600"
                  )}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Schedule for day (leave blank for auto-assign)</Label>
            <Input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                <ChevronDown className={cn("h-4 w-4 mr-1 transition-transform", showDetails && "rotate-180")} />
                Add details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description, notes, steps..."
                rows={3}
              />
            </CollapsibleContent>
          </Collapsible>

          <Button type="submit" className="w-full" disabled={!name.trim() || !dueDate || !minutes}>
            {day ? "Create Task" : "Create & Auto-Assign"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
