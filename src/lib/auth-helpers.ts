import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export function isAdmin(role: string) {
  return role === "admin";
}

export function isManager(role: string) {
  return role === "manager" || role === "admin";
}

export async function writeAudit({
  actorId,
  actorEmail,
  action,
  entityType,
  entityId,
  details,
}: {
  actorId?: number;
  actorEmail: string;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: { actorId, actorEmail, action, entityType, entityId, details: details as any ?? undefined },
  });
}
