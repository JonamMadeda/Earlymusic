"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { Mail, Lock, Loader, ArrowLeft, KeyRound } from "lucide-react";

function AuthForm() {
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const isUpdatePassword = searchParams.get("mode") === "update-password";
  const [mode, setMode] = useState(isUpdatePassword ? "update-password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (isUpdatePassword) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) router.push("/auth");
      });
    }
  }, [isUpdatePassword, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (mode === "reset") {
      const { error: authError } = await resetPassword(email);
      if (authError) {
        setError(authError.message);
      } else {
        setError("Check your email for a password reset link.");
      }
      setSubmitting(false);
      return;
    }

    if (mode === "update-password") {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) {
        setError(authError.message);
      } else {
        setUpdated(true);
        setTimeout(() => router.push("/"), 2000);
      }
      setSubmitting(false);
      return;
    }

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

  if (updated) {
    return (
      <main className="min-h-[90vh] bg-white flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
            <KeyRound size={24} />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Password updated</h2>
          <p className="text-sm text-neutral-500 mt-1">Redirecting you back...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[90vh] bg-white flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter uppercase text-neutral-900">
            earlymusic
          </h1>
          <p className="text-neutral-500 text-sm mt-2 font-medium">
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create an account"}
            {mode === "reset" && "Reset your password"}
            {mode === "update-password" && "Set a new password"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          {mode !== "update-password" && (
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
          )}

          {mode !== "reset" && (
            <div className="flex flex-col gap-y-1">
              <label className="text-xs font-medium text-neutral-500 ml-1">
                {mode === "update-password" ? "New password" : "Password"}
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
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setMode("reset"); setError(""); }}
              className="text-xs font-medium text-neutral-400 hover:text-neutral-900 transition self-end -mt-2"
            >
              Forgot password?
            </button>
          )}

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
            {mode === "login" && "Sign In"}
            {mode === "signup" && "Create Account"}
            {mode === "reset" && "Send Reset Link"}
            {mode === "update-password" && "Update Password"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-8 font-medium">
          {mode === "reset" ? (
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </button>
          ) : mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="text-red-600 font-bold hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="text-red-600 font-bold hover:underline"
              >
                Sign In
              </button>
            </>
          ) : null}
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
