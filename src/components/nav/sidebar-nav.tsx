"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, FolderKanban, Clock, CheckSquare, LogOut, ListTodo, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/schedule", label: "Schedule", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-background md:fixed md:inset-y-0">
      <div className="flex h-14 items-center gap-2 px-4 font-bold text-lg border-b">
        <CheckSquare className="h-5 w-5" />
        DoIt
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
