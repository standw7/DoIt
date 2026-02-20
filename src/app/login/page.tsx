"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = isSignup
        ? await api.signup(email, password)
        : await api.login(email, password);

      await login(result.access_token);
      router.push("/today");
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail ?? "Authentication failed";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 text-3xl font-bold">
          <CheckSquare className="h-8 w-8" />
          DoIt
        </div>
        <p className="text-muted-foreground text-center">
          A calm daily list and project backlog to help you focus on what matters.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder={isSignup ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 8 : undefined}
            />
          </div>
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "..." : isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignup(!isSignup)}
          className="text-sm text-muted-foreground hover:underline"
        >
          {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
