"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/calendar",
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="flex items-center gap-2 text-3xl font-bold">
          <CheckSquare className="h-8 w-8" />
          DoIt
        </div>
        <p className="text-muted-foreground text-center max-w-sm">
          A calm daily list and project backlog to help you focus on what matters.
        </p>
        <Button onClick={signInWithGoogle} size="lg">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
