import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "./progress-bar";
import { ProjectWithProgress } from "@/lib/types";

interface ProjectCardProps {
  project: ProjectWithProgress;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{project.name}</CardTitle>
          {project.goal && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.goal}</p>
          )}
        </CardHeader>
        <CardContent>
          <ProgressBar progress={project.progress} />
          <p className="text-xs text-muted-foreground mt-1">
            {project.done_count}/{project.task_count} tasks
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
