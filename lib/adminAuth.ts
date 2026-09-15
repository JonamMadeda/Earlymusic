import { getUserFromRequest, getAdminFromRequest as getAdminAuth } from "@/lib/auth";
import { NextRequest } from "next/server";

export const getAuthenticatedUser = async (request: NextRequest) => {
  return getUserFromRequest(request);
};

export const isAdmin = async (userId: string) => {
  const { db } = await import("@/lib/neon");
  const { rows } = await db.query(
    "SELECT role FROM public.user_roles WHERE user_id = $1 AND role = 'admin'",
    [userId]
  );
  return rows?.length > 0;
};

export const getAdminFromRequest = async (request: NextRequest) => {
  return getAdminAuth(request);
};
