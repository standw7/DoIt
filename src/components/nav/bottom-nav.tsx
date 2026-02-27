"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderKanban, Clock, ListTodo, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/schedule", label: "Schedule", icon: Clock },
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/overdue", label: "Overdue", icon: AlertTriangle },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) / 2)" }}>
      <div className="flex h-16 items-center justify-around">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
