"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { writeAudit } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const attendanceSchema = z.object({
  userId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hoursWorked: z.coerce.number().min(0).max(24).default(8),
  status: z.enum(["present", "leave", "absent", "half_day"]),
  notes: z.string().optional().nullable(),
});

export async function createAttendance(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Unauthorized");

  const raw = {
    userId: formData.get("userId"),
    date: formData.get("date"),
    hoursWorked: formData.get("hoursWorked"),
    status: formData.get("status"),
    notes: formData.get("notes") || null,
  };

  const data = attendanceSchema.parse(raw);

  const record = await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: data.userId,
        date: new Date(data.date),
      },
    },
    update: {
      hoursWorked: data.hoursWorked,
      status: data.status,
      notes: data.notes,
    },
    create: {
      userId: data.userId,
      date: new Date(data.date),
      hoursWorked: data.hoursWorked,
      status: data.status,
      source: "manual",
      notes: data.notes,
    },
  });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: "recorded attendance",
    entityType: "attendance",
    entityId: record.id,
    details: { userId: data.userId, date: data.date, status: data.status },
  });

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  redirect("/attendance");
}
