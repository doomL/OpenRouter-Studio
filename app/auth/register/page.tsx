"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        router.push("/auth/login");
      } else {
        router.push("/studio");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <img src="/favicon.svg" alt="Logo" className="h-8 w-8" />
            <span className="text-lg font-bold">
              <span className="text-[#ff6b35]">OpenRouter</span>{" "}
              <span className="text-foreground">Studio</span>
            </span>
          </Link>
          <p className="text-sm text-muted-foreground mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35] transition-colors"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35] transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35] transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e55a28] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#ea580c] dark:text-[#ff6b35] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
