"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { RecurringTaskInsert, TaskPriority, DAY_NAMES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

const TIME_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
];

interface RecurringTaskDialogProps {
  onCreate: (task: RecurringTaskInsert) => Promise<void>;
}

export function RecurringTaskDialog({ onCreate }: RecurringTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(30);
  const [customMinutes, setCustomMinutes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [recurrenceDay, setRecurrenceDay] = useState<number>(0);
  const [endDate, setEndDate] = useState("");

  function reset() {
    setName("");
    setDescription("");
    setEstimatedMinutes(30);
    setCustomMinutes("");
    setPriority("medium");
    setRecurrenceDay(0);
    setEndDate("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = customMinutes ? parseInt(customMinutes) : estimatedMinutes;
    if (!name.trim() || !minutes) return;

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        estimated_minutes: minutes,
        priority,
        project_id: null,
        recurrence_day: recurrenceDay,
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
  }

  const minutes = customMinutes ? parseInt(customMinutes) : estimatedMinutes;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add recurring task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Recurring Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Geo Quiz"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div>
            <Label>Repeats every *</Label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {DAY_NAMES.map((day, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={recurrenceDay === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRecurrenceDay(i)}
                  className="px-2.5"
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
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

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes..."
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!name.trim() || !minutes}>
            Create Recurring Task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
