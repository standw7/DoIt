"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Task, TaskPriority } from "@/lib/types";
import { toast } from "sonner";

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange, onUpdate, onDelete }: TaskDetailDialogProps) {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes?.toString() ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [day, setDay] = useState(task.day ?? "");

  useEffect(() => {
    setName(task.name);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setEstimatedMinutes(task.estimated_minutes?.toString() ?? "");
    setDueDate(task.due_date ?? "");
    setDay(task.day ?? "");
  }, [task]);

  function handleSave() {
    try {
      onUpdate(task.id, {
        name: name.trim(),
        description: description.trim() || null,
        priority,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
        due_date: dueDate || null,
        day: day || null,
        status: day && task.status === "backlog" ? "planned" : task.status,
      });
      onOpenChange(false);
      toast.success("Task updated");
    } catch {
      toast.error("Failed to update task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated minutes</Label>
              <Input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} min={5} max={480} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Day (daily list)</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Save</Button>
            <Button variant="destructive" onClick={() => { onDelete(task.id); onOpenChange(false); }}>Delete</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
