"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import BrandMark from "@/app/components/BrandMark";
import { Mail, Lock, Loader, ArrowLeft, KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";

const getSafeRedirect = (value) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
};

function AuthForm() {
  const { user, loading: authLoading, signIn, signUp, changePassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirectTo"));
  const updatePasswordMode = searchParams.get("mode") === "update-password";

  const [mode, setMode] = useState(updatePasswordMode ? "update-password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const passwordRef = useRef(null);

  // Already signed in? The auth form is not the place for it — bounce to
  // the intended page instead of rendering a login form to a session.
  useEffect(() => {
    if (authLoading) return;
    if (user && mode !== "update-password") {
      router.replace(redirectTo);
    }
  }, [authLoading, user, mode, redirectTo, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (mode !== "login" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "update-password") {
        const { error: authError } = await changePassword({ currentPassword, password });
        if (authError) {
          setError(authError.message);
        } else {
          setUpdated(true);
          setTimeout(() => router.push("/account"), 2500);
        }
        return;
      }

      const fn = mode === "login" ? signIn : signUp;
      const { error: authError, exists } = await fn(email, password);

      if (exists) {
        // Email already has an account — move to sign-in instead of a
        // dead end. Clear the password field so the stale one is gone.
        setMessage("An account with this email already exists. Sign in with your password instead.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => passwordRef.current?.focus(), 0);
        return;
      }

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (updated) {
    return (
      <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent mx-auto mb-4">
            <KeyRound size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Password updated</h2>
          <p className="text-sm text-neutral-500 mt-1">
            You&rsquo;ll stay signed in on this device. Everywhere else has been
            signed out.
          </p>
          <p className="text-xs text-neutral-400 mt-3">Redirecting to your account…</p>
        </div>
      </main>
    );
  }

  if (updatePasswordMode && !authLoading && !user) {
    return (
      <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mx-auto mb-4">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Sign in to continue</h2>
          <p className="text-sm text-neutral-500 mt-1">
            You need to be signed in before you can change your password.
          </p>
          <button
            onClick={() => router.push("/auth?redirectTo=/account")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-accent/90"
          >
            <Lock size={14} aria-hidden="true" />
            Go to sign in
          </button>
        </div>
      </main>
    );
  }

  const isSignup = mode === "signup";
  const isUpdatePassword = mode === "update-password";
  const isLogin = mode === "login";

  return (
    <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="mb-5 flex items-center justify-center gap-2">
            <BrandMark className="h-7 w-7" />
            <span className="text-[15px] font-bold tracking-tight text-neutral-900">
              Luumbo
            </span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 uppercase">
              {isLogin && "Sign In"}
              {isSignup && "Sign Up"}
              {isUpdatePassword && "Update Password"}
            </h1>
          </div>
          <p className="text-neutral-500 text-sm mt-2 font-medium">
            {isLogin && "Welcome back"}
            {isSignup && "Create an account"}
            {isUpdatePassword && "Choose a new password"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4" noValidate={false}>
          {!isUpdatePassword && (
            <div className="flex flex-col gap-y-1">
              <label htmlFor="auth-email" className="text-xs font-medium text-neutral-500 ml-1">
                Email
              </label>
              <div className="flex items-center gap-x-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:border-accent transition">
                <Mail size={18} className="text-neutral-400 shrink-0" aria-hidden="true" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(error) || undefined}
                  aria-describedby={error ? "auth-error" : undefined}
                  className="bg-transparent outline-none flex-1 min-w-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                  required
                  maxLength={254}
                />
              </div>
            </div>
          )}

          {isUpdatePassword && (
            <div className="flex flex-col gap-y-1">
              <label htmlFor="auth-current-password" className="text-xs font-medium text-neutral-500 ml-1">
                Current password
              </label>
              <div className="flex items-center gap-x-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:border-accent transition">
                <Lock size={18} className="text-neutral-400 shrink-0" aria-hidden="true" />
                <input
                  id="auth-current-password"
                  name="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  aria-describedby={error ? "auth-error" : undefined}
                  className="bg-transparent outline-none flex-1 min-w-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                  required
                  maxLength={72}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  aria-pressed={showCurrentPassword}
                  className="text-neutral-400 hover:text-neutral-600 transition shrink-0"
                >
                  {showCurrentPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-y-1">
            <label htmlFor="auth-password" className="text-xs font-medium text-neutral-500 ml-1">
              {isUpdatePassword ? "New password" : "Password"}
            </label>
            <div className="flex items-center gap-x-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:border-accent transition">
              <Lock size={18} className="text-neutral-400 shrink-0" aria-hidden="true" />
              <input
                id="auth-password"
                name="password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? "auth-error" : isLogin ? undefined : "auth-password-hint"}
                className="bg-transparent outline-none flex-1 min-w-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                required
                minLength={8}
                maxLength={72}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="text-neutral-400 hover:text-neutral-600 transition shrink-0"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {!isLogin && (
              <p id="auth-password-hint" className="text-[10px] text-neutral-400 ml-1">
                Use 8–72 characters. Passphrases work well.
              </p>
            )}
          </div>

          {mode !== "login" && (
            <div className="flex flex-col gap-y-1">
              <label htmlFor="auth-confirm-password" className="text-xs font-medium text-neutral-500 ml-1">
                Confirm password
              </label>
              <div className="flex items-center gap-x-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:border-accent transition">
                <ShieldCheck size={18} className="text-neutral-400 shrink-0" aria-hidden="true" />
                <input
                  id="auth-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={Boolean(confirmPassword) && confirmPassword !== password}
                  className="bg-transparent outline-none flex-1 min-w-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                  required
                  minLength={8}
                  maxLength={72}
                />
              </div>
            </div>
          )}

          {error && (
            <p id="auth-error" role="alert" className="text-[13px] font-medium text-red-600 text-center">
              {error}
            </p>
          )}

          {message && (
            <p role="status" aria-live="polite" className="text-[13px] font-medium text-emerald-600 text-center">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || (isUpdatePassword && authLoading)}
            aria-busy={submitting}
            className="bg-accent py-3.5 rounded-xl text-white font-bold hover:bg-accent/90 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader size={16} className="animate-spin" aria-hidden="true" />}
            {isLogin && "Sign In"}
            {isSignup && "Create Account"}
            {isUpdatePassword && "Update Password"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-8 font-medium">
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
                className="text-accent font-bold hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : isSignup ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className="text-accent font-bold hover:underline"
              >
                Sign In
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/account")}
              className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to account
            </button>
          )}
        </p>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[90vh] flex items-center justify-center"><Loader aria-hidden="true" /></div>}>
      <AuthForm />
    </Suspense>
  );
}
