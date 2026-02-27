"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavWrapper } from "@/components/nav/nav-wrapper";
import { useAuth } from "@/lib/auth-context";
import { prefetchCalendarEvents } from "@/lib/prefetch";
import { format, addDays } from "date-fns";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Allow Google callback through without redirecting to login —
  // the settings page handles token restoration and code exchange
  const isGoogleCallback = searchParams.get("google") === "callback";

  useEffect(() => {
    if (!loading && !isAuthenticated && !isGoogleCallback) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router, isGoogleCallback]);

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

  // Allow Google callback through even if not yet authenticated (token being restored)
  if (!isAuthenticated && !isGoogleCallback) {
    return null;
  }

  return <NavWrapper>{children}</NavWrapper>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    }>
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}
