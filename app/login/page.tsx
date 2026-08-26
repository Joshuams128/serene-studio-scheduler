"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Logo, Note } from "@/components/ui";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("That password doesn't match. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      {/* Soft cornsilk wash, echoing the studio site's hero treatment. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#FEFAE0_0%,#FAF8F3_55%,#FAF8F3_100%)]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={88} withWordmark={false} />
          <h1 className="mt-5 text-3xl font-light tracking-tight text-ink">
            Serene Pilates
          </h1>
          <p className="eyebrow mt-2 text-sand">Studio Scheduler</p>
        </div>

        <Card className="p-7">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Studio password
              </span>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </label>

            {error && <Note tone="alert">{error}</Note>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy || !password}
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs font-light leading-relaxed text-sage">
          Instructors don&apos;t sign in here — they use the private link the
          studio sends them.
        </p>
      </div>
    </main>
  );
}
