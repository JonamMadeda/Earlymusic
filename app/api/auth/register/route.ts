import { NextRequest, NextResponse } from "next/server";
import { hashPassword, signToken } from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "auth-register", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Email and password (min 6 chars) are required." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.query("SELECT id FROM public.users WHERE email = $1", [normalizedEmail]);
    if (existing.rows?.length) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      "INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [normalizedEmail, passwordHash]
    );
    const user = result.rows[0];

    await db.query("INSERT INTO public.profiles (id) VALUES ($1)", [user.id]);

    const token = await signToken({ sub: user.id, email: user.email });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      token,
    }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Unable to register." }, { status: 500 });
  }
}
