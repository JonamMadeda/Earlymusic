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

const initialMode = (modeParam, resetToken) => {
  if (modeParam === "update-password") return "update-password";
  if (modeParam === "reset" && resetToken) return "reset";
  if (modeParam === "forgot") return "forgot";
  return "login";
};

function AuthForm() {
  const { user, loading: authLoading, signIn, signUp, changePassword, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirectTo"));
  const modeParam = searchParams.get("mode");
  const resetToken = searchParams.get("token") || "";
  const updatePasswordMode = modeParam === "update-password";

  const [mode, setMode] = useState(() => initialMode(modeParam, resetToken));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const passwordRef = useRef(null);

  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isSignup = mode === "signup";
  const isUpdatePassword = mode === "update-password";
  const isLogin = mode === "login";
  // Only the sign-in screens are for people who are not already signed in;
  // recovering a password is valid while a session is live.
  const bounceWhenSignedIn = !isForgot && !isReset && !isUpdatePassword;

  // Already signed in? The auth form is not the place for it — bounce to
  // the intended page instead of rendering a login form to a session.
  useEffect(() => {
    if (authLoading) return;
    if (user && bounceWhenSignedIn) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, bounceWhenSignedIn, redirectTo, router]);

  const postJson = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevLink("");

    if ((isSignup || isReset || isUpdatePassword) && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (isForgot) {
        const { ok, data } = await postJson("/api/auth/forgot-password", { email });
        if (!ok) {
          setError(data.error || "Unable to start a password reset right now.");
          return;
        }
        setMessage(data.message);
        if (data.devLink) setDevLink(data.devLink);
        return;
      }

      if (isReset) {
        const { ok, data } = await postJson("/api/auth/reset-password", {
          token: resetToken,
          password,
        });
        if (!ok) {
          setError(data.error || "Unable to reset your password right now.");
          return;
        }
        // The route revoked every session, including this device's cookie.
        // Without this the UI keeps a stale signed-in state whose requests
        // all 401, and "Sign in" below bounces to the home page instead of
        // showing the form.
        setResetDone(true);
        await signOut();
        return;
      }

      if (isUpdatePassword) {
        const { error: authError } = await changePassword({ currentPassword, password });
        if (authError) {
          setError(authError.message);
        } else {
          setUpdated(true);
          setTimeout(() => router.push("/account"), 2500);
        }
        return;
      }

      const fn = isLogin ? signIn : signUp;
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

  const goBackToLogin = () => {
    setMode("login");
    setResetDone(false);
    setError("");
    setMessage("");
    setDevLink("");
    setPassword("");
    setConfirmPassword("");
    // Drop the consumed token from the address bar so it cannot linger in
    // browser history or be reloaded as a dead reset form.
    router.replace("/auth");
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

  if (resetDone) {
    return (
      <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-4">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Password reset</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Your password is changed and every other device has been signed
            out. Sign in here with the new one.
          </p>
          <button
            onClick={goBackToLogin}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-accent/90"
          >
            <Lock size={14} aria-hidden="true" />
            Sign in
          </button>
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

  if (modeParam === "reset" && !resetToken) {
    return (
      <ResultScreen
        title="Reset link incomplete"
        body="This link is missing its token. Request a new reset email and open the link it sends."
        actionLabel="Send me a new link"
        onAction={() => {
          router.replace("/auth?mode=forgot");
          setMode("forgot");
          setError("");
          setMessage("");
        }}
      />
    );
  }

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
              {isForgot && "Forgot Password"}
              {isReset && "Choose a New Password"}
            </h1>
          </div>
          <p className="text-neutral-500 text-sm mt-2 font-medium">
            {isLogin && "Welcome back"}
            {isSignup && "Create an account"}
            {isUpdatePassword && "Choose a new password"}
            {isForgot && "We’ll email you a reset link"}
            {isReset && "Pick something you haven’t used before"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4" noValidate={false}>
          {!isUpdatePassword && !isReset && (
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

          {!isForgot && (
            <div className="flex flex-col gap-y-1">
              <label htmlFor="auth-password" className="text-xs font-medium text-neutral-500 ml-1">
                {isUpdatePassword || isReset ? "New password" : "Password"}
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
          )}

          {(isSignup || isReset || isUpdatePassword) && (
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

          {devLink && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
              <p className="text-[11px] font-bold text-neutral-500 uppercase">Local development</p>
              <a
                href={devLink}
                className="block mt-1 text-[11px] text-accent break-all underline"
              >
                {devLink}
              </a>
            </div>
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
            {isForgot && "Send Reset Link"}
            {isReset && "Reset Password"}
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
          ) : isSignup || isForgot || isReset ? (
            <>
              Already have an account?{" "}
              <button
                onClick={goBackToLogin}
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

        {isLogin && (
          <p className="text-center text-sm text-neutral-500 mt-3 font-medium">
            <button
              onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}
              className="text-neutral-500 hover:text-neutral-900 transition underline underline-offset-2"
            >
              Forgot password?
            </button>
          </p>
        )}

        {isForgot && !message && (
          <p className="text-center text-xs text-neutral-400 mt-4">
            Enter the email you signed up with. The link works once and
            expires in 30 minutes.
          </p>
        )}
      </div>
    </main>
  );
}

function ResultScreen({ title, body, actionLabel, onAction }) {
  return (
    <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mx-auto mb-4">
          <KeyRound size={24} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500 mt-1">{body}</p>
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-accent/90"
        >
          <Mail size={14} aria-hidden="true" />
          {actionLabel}
        </button>
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
