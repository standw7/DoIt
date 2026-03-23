"use client";

import { useEffect, useMemo } from "react";
import { NavWrapper } from "@/components/nav/nav-wrapper";
import { useAuth } from "@/lib/auth-context";
import { prefetchCalendarEvents } from "@/lib/prefetch";
import { format, addDays } from "date-fns";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  // Prefetch calendar events as soon as user is authenticated
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const futureStr = useMemo(() => format(addDays(new Date(), 14), "yyyy-MM-dd"), []);

  useEffect(() => {
    if (isAuthenticated) {
      prefetchCalendarEvents(todayStr, futureStr);
    }
  }, [isAuthenticated, todayStr, futureStr]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <NavWrapper>{children}</NavWrapper>;
}
