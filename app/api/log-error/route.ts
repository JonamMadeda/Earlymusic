import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";

const RETENTION = "90 days";

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "app-error",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const message =
      typeof body?.message === "string" ? body.message.slice(0, 500) : "";
    if (!message) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }

    const stack = typeof body?.stack === "string" ? body.stack.slice(0, 2000) : null;
    const path = typeof body?.path === "string" ? body.path.slice(0, 300) : null;

    await db.query(
      `INSERT INTO public.app_errors (message, stack, path, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        message,
        stack,
        path,
        getClientIp(request),
        request.headers.get("user-agent")?.slice(0, 512) ?? null,
      ]
    );

    if (Math.random() < 0.02) {
      void db
        .query(`DELETE FROM public.app_errors WHERE created_at < now() - $1::interval`, [RETENTION])
        .catch(() => {});
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unable to record client error:", error);
    return NextResponse.json({ error: "Unable to record the error." }, { status: 500 });
  }
}
