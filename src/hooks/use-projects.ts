"use client";

import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import { ProjectWithProgress, ProjectInsert } from "@/lib/types";
import { toast } from "sonner";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch {
      toast.error("Failed to load projects");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function createProject(project: ProjectInsert) {
    try {
      await api.createProject(project);
      await fetchProjects();
    } catch {
      toast.error("Failed to create project");
    }
  }

  async function updateProject(id: string, updates: Partial<ProjectInsert>) {
    try {
      await api.updateProject(id, updates);
      await fetchProjects();
    } catch {
      toast.error("Failed to update project");
    }
  }

  async function deleteProject(id: string) {
    try {
      await api.deleteProject(id);
      await fetchProjects();
    } catch {
      toast.error("Failed to delete project");
    }
  }

  return { projects, loading, createProject, updateProject, deleteProject, refetch: fetchProjects };
}
