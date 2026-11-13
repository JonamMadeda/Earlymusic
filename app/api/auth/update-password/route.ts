import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { validatePassword } from "@/lib/authValidation";
import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/neon";
import {
  findLegacyCredentialByUserId,
  getCredentialAccount,
  markLegacyUpgraded,
  setCredentialPassword,
  verifyCredentialPassword,
  verifyLegacyPassword,
  writeCredentialAccount,
} from "@/lib/credentials";

export async function PATCH(request: NextRequest) {
  const ipLimited = await checkRateLimit(request, {
    name: "auth-update-pw-ip",
    limit: 10,
    windowMs: 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const userLimited = await checkRateLimit(request, {
      name: "auth-update-pw-user",
      limit: 5,
      windowMs: 15 * 60_000,
      key: user.id,
    });
    if (userLimited) return userLimited;

    const { currentPassword, password } = await request.json();
    if (
      typeof currentPassword !== "string" ||
      currentPassword.length === 0 ||
      currentPassword.length > 1024
    ) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    let account = await getCredentialAccount(user.id);

    if (!account) {
      // Account that predates Neon Auth: verify the parked bcrypt hash,
      // then give it a real Neon Auth credential before changing it.
      const legacy = await findLegacyCredentialByUserId(user.id);
      if (
        !legacy ||
        !(await verifyLegacyPassword(currentPassword, legacy.password_hash))
      ) {
        await logAuthEvent(request, "password_change_failed", {
          userId: user.id,
          email: user.email,
          detail: { result: "wrong_current_password" },
        });
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      // Check reuse before the upgrade writes anything: a rejected request
      // must not leave a half-migrated credential behind.
      if (await verifyLegacyPassword(password, legacy.password_hash)) {
        await logAuthEvent(request, "password_change_failed", {
          userId: user.id,
          email: user.email,
          detail: { result: "password_reused" },
        });
        return NextResponse.json(
          { error: "Choose a password you have not used before." },
          { status: 400 }
        );
      }

      const accountId = await writeCredentialAccount(user.id, currentPassword);
      await markLegacyUpgraded(user.id);
      account = { id: accountId, password: null } as any;
    } else {
      const valid = await verifyCredentialPassword(
        currentPassword,
        account.password
      );
      if (!valid) {
        await logAuthEvent(request, "password_change_failed", {
          userId: user.id,
          email: user.email,
          detail: { result: "wrong_current_password" },
        });
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      if (await verifyCredentialPassword(password, account.password)) {
        await logAuthEvent(request, "password_change_failed", {
          userId: user.id,
          email: user.email,
          detail: { result: "password_reused" },
        });
        return NextResponse.json(
          { error: "Choose a password you have not used before." },
          { status: 400 }
        );
      }
    }

    await setCredentialPassword(account.id, password);

    // A password change ends every other session; the current device keeps
    // working because it re-authenticated with the old password.
    await db.query(
      `DELETE FROM neon_auth.session WHERE "userId" = $1 AND id <> $2`,
      [user.id, user.session_id]
    );

    await logAuthEvent(request, "password_changed", {
      userId: user.id,
      email: user.email,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json(
      { error: "Unable to update password." },
      { status: 500 }
    );
  }
}
