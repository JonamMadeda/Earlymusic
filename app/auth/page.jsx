"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
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
  if (modeParam === "signup") return "signup";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
const [submitting, setSubmitting] = useState(false);
const [updated, setUpdated] = useState(false);
const [resetDone, setResetDone] = useState(false);
const [showPassword, setShowPassword] = useState(false);
const [showCurrentPassword, setShowCurrentPassword] = useState(false);
const [tosAccepted, setTosAccepted] = useState(false);
const [privacyAccepted, setPrivacyAccepted] = useState(false);
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

    if ((isSignup || isReset || isUpdatePassword) && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (isSignup && (!firstName.trim() || !lastName.trim())) {
      setError("Enter your first and last name.");
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

      if (isLogin) {
        const { error: authError, code } = await signIn(email, password);
        if (authError) {
          // The code screen can send a fresh code, so give them a way to act.
          if (code === "EMAIL_NOT_VERIFIED") {
            setVerificationSent(true);
            return;
          }
          setError(authError.message);
          return;
        }
        router.push(redirectTo);
        router.refresh();
        return;
      }

      const { error: authError, verificationRequired } = await signUp(
        email,
        password,
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          tos_accepted: tosAccepted,
          privacy_accepted: privacyAccepted,
        }
      );

      if (authError) {
        setError(authError.message);
        return;
      }

      // Sign-up does not open a session: the address has to be confirmed
      // with the emailed code first.
      if (verificationRequired) {
        setVerificationSent(true);
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

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setMessage("");
  };

  const goBackToLogin = () => {
    setMode("login");
    setResetDone(false);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    // Drop the consumed token from the address bar so it cannot linger in
    // browser history or be reloaded as a dead reset form.
    router.replace("/auth");
  };

  if (verificationSent) {
    return (
      <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 py-9 text-center shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Mail size={24} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-neutral-900">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            Enter the six-digit code sent to <strong className="text-neutral-700">{email}</strong>. It expires in five minutes.
          </p>
          <form
            className="mt-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitting(true);
              setError("");
              setMessage("");
              const { ok, data } = await postJson("/api/auth/verify-email", {
                email,
                otp: verificationCode,
              });
              if (ok) {
                setVerificationSent(false);
                setVerificationCode("");
                setMode("login");
                setMessage("Email verified. You can sign in now.");
              } else {
                setError(data.error || "Unable to verify your email.");
              }
              setSubmitting(false);
            }}
          >
            <label htmlFor="verification-code" className="sr-only">Six-digit verification code</label>
            <input
              id="verification-code"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={Boolean(error) || undefined}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-xl font-bold tracking-[0.4em] text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
            />
            {message && <p role="status" className="mt-3 text-xs font-medium text-emerald-600">{message}</p>}
            {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || verificationCode.length !== 6}
              aria-busy={submitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
            >
              {submitting && <Loader size={15} className="animate-spin" aria-hidden="true" />}
              Verify email
            </button>
          </form>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError("");
              setMessage("");
              const { ok, data } = await postJson("/api/auth/resend-verification", { email });
              if (ok) setMessage(data.message);
              else setError(data.error || "Unable to resend the email.");
              setSubmitting(false);
            }}
            className="mt-4 w-full rounded-xl border border-neutral-200 px-4 py-3 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {submitting ? "Please wait…" : "Send a new code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationSent(false);
              setVerificationCode("");
              setMode("login");
              setPassword("");
              setError("");
              setMessage("");
            }}
            className="mt-3 text-xs font-semibold text-accent hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  if (updated) {
    return (
      <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 py-9 text-center shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
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
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 py-9 text-center shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
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
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 py-9 text-center shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
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
    <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] sm:p-7">
        <div className="text-center mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">
            Luumbo
          </p>
          <h1 className="mt-3 text-[22px] font-bold tracking-tight text-neutral-900">
            {isLogin && "Sign In"}
            {isSignup && "Sign Up"}
            {isUpdatePassword && "Update Password"}
            {isForgot && "Forgot Password"}
            {isReset && "Choose a New Password"}
          </h1>
          <p className="text-neutral-500 text-[13px] mt-1.5 font-medium">
            {isLogin && "Welcome back. Pick up where you left off."}
            {isSignup && "Save songs and keep your library in one place."}
            {isUpdatePassword && "Choose a new password"}
            {isForgot && "We’ll email you a reset link"}
            {isReset && "Pick something you haven’t used before"}
          </p>
        </div>

        {(isLogin || isSignup) && (
          <div
            role="group"
            aria-label="Choose how to continue"
            className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1"
          >
            {[
              { key: "login", label: "Sign In" },
              { key: "signup", label: "Sign Up" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={mode === tab.key}
                onClick={() => switchMode(tab.key)}
                className={`rounded-lg py-2 text-xs font-bold tracking-tight transition outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  mode === tab.key
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4" noValidate={false}>
          {isSignup && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="auth-first-name" className="text-xs font-medium text-neutral-500 ml-1">
                  First name
                </label>
                <div className="flex items-center p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:border-accent transition">
                  <input
                    id="auth-first-name"
                    name="given-name"
                    type="text"
                    autoComplete="given-name"
                    autoCapitalize="words"
                    placeholder="First"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-transparent outline-none w-full min-w-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                    required
                    maxLength={40}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-1">
                <label htmlFor="auth-last-name" className="text-xs font-medium text-neutral-500 ml-1">
                  Last name
                </label>
                <div className="flex items-center p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:border-accent transition">
                  <input
                    id="auth-last-name"
                    name="family-name"
                    type="text"
                    autoComplete="family-name"
                    autoCapitalize="words"
                    placeholder="Last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-transparent outline-none w-full min-w-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-300"
                    required
                    maxLength={40}
                  />
                </div>
              </div>
            </div>
          )}

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

          {isSignup && (
            <div className="flex flex-col gap-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="auth-tos"
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                <label htmlFor="auth-tos" className="text-[12px] font-medium text-neutral-600 leading-relaxed">
                  I accept the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Terms of Service
                  </Link>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="auth-privacy"
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                <label htmlFor="auth-privacy" className="text-[12px] font-medium text-neutral-600 leading-relaxed">
                  I accept the{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                You must be at least 13 years old. If you are under 18, ask a
                parent or guardian first.
              </p>
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
            disabled={
              submitting ||
              (isUpdatePassword && authLoading) ||
              (isSignup && (!tosAccepted || !privacyAccepted))
            }
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

        <div className="mt-6 border-t border-neutral-100 pt-4 text-center">
          {isLogin && (
            <p className="text-sm text-neutral-500 font-medium">
              <button
                onClick={() => switchMode("forgot")}
                className="text-neutral-500 hover:text-neutral-900 transition underline underline-offset-2"
              >
                Forgot password?
              </button>
            </p>
          )}

          {(isForgot || isReset) && (
            <p className="text-sm text-neutral-500 font-medium">
              Already have an account?{" "}
              <button
                onClick={goBackToLogin}
                className="text-accent font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          )}

          {isUpdatePassword && (
            <button
              onClick={() => router.push("/account")}
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to account
            </button>
          )}

          {isSignup && (
            <p className="text-[11px] font-medium leading-relaxed text-neutral-400">
              Your email is only used for signing in and password resets.
            </p>
          )}

          {isForgot && !message && (
            <p className="text-[11px] font-medium text-neutral-400 mt-1.5">
              Use the email you signed up with. The link works once and
              expires in an hour.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function ResultScreen({ title, body, actionLabel, onAction }) {
  return (
    <main className="min-h-[90vh] bg-transparent flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 py-9 text-center shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
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
