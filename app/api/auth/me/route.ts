import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    return NextResponse.json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Unable to verify session." }, { status: 500 });
  }
}
