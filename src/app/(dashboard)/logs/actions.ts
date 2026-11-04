"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { writeAudit } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const logSchema = z.object({
  userId: z.coerce.number().int().positive(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity: z.string().min(3).max(1000),
  quantity: z.coerce.number().optional(),
  status: z.enum(["pending", "verified", "needs_clarification", "rejected"]),
  notes: z.string().max(500).optional(),
});

export async function createLog(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = logSchema.parse({
    userId: formData.get("userId"),
    logDate: formData.get("logDate"),
    activity: formData.get("activity"),
    quantity: formData.get("quantity") || undefined,
    status: formData.get("status") ?? "pending",
    notes: formData.get("notes") || undefined,
  });

  // Employees can only add their own logs
  if (session.user.role === "employee" && data.userId !== parseInt(session.user.id)) {
    throw new Error("Forbidden");
  }

  const log = await prisma.dailyLog.create({
    data: {
      userId: data.userId,
      logDate: new Date(data.logDate),
      activity: data.activity,
      quantity: data.quantity,
      status: data.status,
      source: "manual",
      notes: data.notes,
    },
  });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: "created daily log",
    entityType: "daily_log",
    entityId: log.id,
    details: { activity: data.activity, quantity: data.quantity },
  });

  revalidatePath("/logs");
  revalidatePath("/dashboard");
}

export async function updateLogStatus(logId: number, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!["admin", "manager"].includes(session.user.role)) throw new Error("Forbidden");

  const verifiedBy =
    status === "verified" ? parseInt(session.user.id) : undefined;
  const verifiedAt = status === "verified" ? new Date() : undefined;

  await prisma.dailyLog.update({
    where: { id: logId },
    data: {
      status: status as any,
      verifiedBy,
      verifiedAt,
    },
  });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: `set log status to ${status}`,
    entityType: "daily_log",
    entityId: logId,
  });

  revalidatePath("/logs");
  revalidatePath("/dashboard");
}

export async function deleteLog(logId: number) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Forbidden");

  await prisma.dailyLog.delete({ where: { id: logId } });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: "deleted daily log",
    entityType: "daily_log",
    entityId: logId,
  });

  revalidatePath("/logs");
  revalidatePath("/dashboard");
}
