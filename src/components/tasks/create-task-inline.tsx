"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskInsert } from "@/lib/types";
import { toast } from "sonner";

interface CreateTaskInlineProps {
  projectId?: string;
  day?: string;
  onCreate: (task: TaskInsert) => Promise<void>;
}

export function CreateTaskInline({ projectId, day, onCreate }: CreateTaskInlineProps) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await onCreate({
        name: name.trim(),
        project_id: projectId ?? null,
        day: day ?? null,
        status: day ? "planned" : "backlog",
        priority: "medium",
        description: null,
        estimated_minutes: null,
        due_date: null,
        split_allowed: false,
        tags: null,
        sort_order: 0,
      });
      setName("");
      setAdding(false);
    } catch {
      toast.error("Failed to create task");
    }
  }

  if (!adding) {
    return (
      <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4 mr-2" /> Add task
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name..."
        maxLength={80}
        autoFocus
        onBlur={() => { if (!name.trim()) setAdding(false); }}
      />
      <Button type="submit" size="sm">Add</Button>
    </form>
  );
}
