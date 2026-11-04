import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getUserFromRequest } from "@/lib/auth";
import { logAuthEvent } from "@/lib/authAudit";
import {
  findLegacyCredentialByUserId,
  getCredentialAccount,
  verifyCredentialPassword,
  verifyLegacyPassword,
} from "@/lib/credentials";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "auth-delete-account-ip",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const userLimited = await checkRateLimit(request, {
      name: "auth-delete-account-user",
      limit: 5,
      windowMs: 15 * 60_000,
      key: user.id,
    });
    if (userLimited) return userLimited;

    const { password } = await request.json();
    if (
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 1024
    ) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 }
      );
    }

    const account = await getCredentialAccount(user.id);
    const legacy = account ? null : await findLegacyCredentialByUserId(user.id);
    const valid = account
      ? await verifyCredentialPassword(password, account.password)
      : legacy
        ? await verifyLegacyPassword(password, legacy.password_hash)
        : false;

    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    await db.query(`DELETE FROM neon_auth.user WHERE id = $1`, [user.id]);
    await db.query(`DELETE FROM public.legacy_credentials WHERE user_id = $1`, [
      user.id,
    ]);
    await logAuthEvent(request, "account_deleted", {
      userId: user.id,
      email: user.email,
    });

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Unable to delete the account right now." },
      { status: 500 }
    );
  }
}
