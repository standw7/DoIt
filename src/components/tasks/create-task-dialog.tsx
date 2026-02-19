"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronDown } from "lucide-react";
import { TaskInsert, TaskPriority, Task, CalendarEvent, RecurringTaskInsert, DAY_NAMES } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { pickBestDay } from "@/lib/scheduler";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProjectOption {
  id: string;
  name: string;
}

interface CreateTaskDialogProps {
  projectId?: string;
  day?: string;
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  onCreate: (task: TaskInsert) => Promise<void>;
  onCreateRecurring?: (task: RecurringTaskInsert) => Promise<void>;
  projects?: ProjectOption[];
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
  onCreateRecurring,
  projects,
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState<number>(0);
  const [availableDaysBefore, setAvailableDaysBefore] = useState<string>("");
  const [endDate, setEndDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("none");

  function reset() {
    setName("");
    setDueDate("");
    setDay(prefillDay ?? "");
    setEstimatedMinutes(null);
    setCustomMinutes("");
    setPriority("medium");
    setDescription("");
    setShowDetails(false);
    setIsRecurring(false);
    setRecurrenceDay(0);
    setAvailableDaysBefore("");
    setEndDate("");
    setSelectedProjectId("none");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = customMinutes ? parseInt(customMinutes) : estimatedMinutes;
    if (!name.trim() || !minutes) return;

    const effectiveProjectId = projectId ?? (selectedProjectId !== "none" ? selectedProjectId : null);

    if (isRecurring && onCreateRecurring) {
      try {
        await onCreateRecurring({
          name: name.trim(),
          description: description.trim() || null,
          estimated_minutes: minutes,
          priority,
          project_id: effectiveProjectId,
          recurrence_day: recurrenceDay,
          available_days_before: availableDaysBefore ? parseInt(availableDaysBefore) : null,
          start_date: format(new Date(), "yyyy-MM-dd"),
          end_date: endDate || null,
          active: true,
        });
        reset();
        setOpen(false);
        toast.success(`Recurring task created — every ${DAY_NAMES[recurrenceDay]}`);
      } catch {
        toast.error("Failed to create recurring task");
      }
      return;
    }

    if (!dueDate) return;

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
        project_id: effectiveProjectId,
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

          {onCreateRecurring && (
            <div className="flex items-center gap-3">
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
                id="recurring-toggle"
              />
              <Label htmlFor="recurring-toggle" className="cursor-pointer">
                Make recurring
              </Label>
            </div>
          )}

          {isRecurring ? (
            <>
              <div>
                <Label>Repeats every *</Label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {DAY_NAMES.map((dayName, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={recurrenceDay === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRecurrenceDay(i)}
                      className="px-2.5"
                    >
                      {dayName.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Available days before due (optional)</Label>
                <Input
                  type="number"
                  value={availableDaysBefore}
                  onChange={(e) => setAvailableDaysBefore(e.target.value)}
                  placeholder="e.g., 5"
                  min={1}
                  max={7}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Task opens N days before due (e.g., prelab opens 5 days early)
                </p>
              </div>
              <div>
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to repeat indefinitely
                </p>
              </div>
            </>
          ) : (
            <div>
              <Label>Due date *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          )}

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

          {!isRecurring && (
            <div>
              <Label>Schedule for day (leave blank for auto-assign)</Label>
              <Input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          )}

          {!projectId && projects && projects.length > 0 && (
            <div>
              <Label>Project (optional)</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || !minutes || (!isRecurring && !dueDate)}
          >
            {isRecurring
              ? "Create Recurring Task"
              : day
                ? "Create Task"
                : "Create & Auto-Assign"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
