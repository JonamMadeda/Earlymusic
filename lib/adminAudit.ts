import { db } from "@/lib/neon";

type AuditEvent = {
  actorId: string;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
};

export const logAdminAction = async (event: AuditEvent): Promise<void> => {
  try {
    await db.query(
      `INSERT INTO public.admin_audit_log (actor_id, action, target_id, detail)
       VALUES ($1, $2, $3, $4)`,
      [event.actorId, event.action, event.target || null, JSON.stringify(event.detail || {})]
    );
  } catch (error) {
    console.error("Unable to write admin audit log:", error);
  }
};
