"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { Mail, Lock, Loader } from "lucide-react";

function AuthForm() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const fn = mode === "login" ? signIn : signUp;
    const { error: authError } = await fn(email, password);

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
    } else if (mode === "signup") {
      setError("Check your email for a confirmation link.");
      setSubmitting(false);
    } else {
      router.push(redirectTo);
    }
  };

  return (
    <main className="min-h-[90vh] bg-white flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter uppercase text-neutral-900">
            earlymusic
          </h1>
          <p className="text-neutral-500 text-sm mt-2 font-medium">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-1">
            <label className="text-xs font-medium text-neutral-500 ml-1">
              Email
            </label>
            <div className="flex items-center gap-x-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
              <Mail size={18} className="text-neutral-400" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent outline-none flex-1 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-1">
            <label className="text-xs font-medium text-neutral-500 ml-1">
              Password
            </label>
            <div className="flex items-center gap-x-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
              <Lock size={18} className="text-neutral-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent outline-none flex-1 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <p className="text-[13px] font-medium text-red-600 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-red-600 py-3.5 rounded-xl text-white font-bold hover:bg-neutral-900 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader size={16} className="animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-8 font-medium">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="text-red-600 font-bold hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="text-red-600 font-bold hover:underline"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[90vh] flex items-center justify-center"><Loader /></div>}>
      <AuthForm />
    </Suspense>
  );
}
