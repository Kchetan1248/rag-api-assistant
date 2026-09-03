"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BrainCircuit, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { API_BASE_URL } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to login");
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      toast.success("Welcome back!");
      router.push("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#0A0A0A] p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl border border-black/[0.04] dark:border-white/[0.04] rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-900 dark:from-white dark:to-neutral-200 text-white dark:text-neutral-900 shadow-xl mb-4">
            <BrainCircuit className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Welcome back</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 mt-6"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 mt-8">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
