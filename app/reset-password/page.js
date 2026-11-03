"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ForwardToAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    router.replace(token ? `/auth?mode=reset&token=${encodeURIComponent(token)}` : "/auth?mode=forgot");
  }, [router, searchParams]);

  return null;
}

// Better Auth's reset emails can carry the link to /reset-password?token=…,
// while this app's screen lives at /auth?mode=reset. Land either shape.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForwardToAuth />
    </Suspense>
  );
}
