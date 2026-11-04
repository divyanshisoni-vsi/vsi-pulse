"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { writeAudit } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

const employeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "manager", "employee"]),
  teamId: z.coerce.number().int().positive().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  monthlyTarget: z.coerce.number().int().min(0).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function createEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Unauthorized");

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    teamId: formData.get("teamId") ? Number(formData.get("teamId")) : null,
    jobTitle: formData.get("jobTitle") || null,
    monthlyTarget: formData.get("monthlyTarget") || 0,
    status: formData.get("status") || "active",
  };

  const data = employeeSchema.parse(raw);
  if (!data.password) throw new Error("Password is required for new employee");

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase().trim(),
      passwordHash,
      role: data.role,
      teamId: data.teamId,
      jobTitle: data.jobTitle,
      monthlyTarget: data.monthlyTarget,
      status: data.status,
    },
  });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: "created employee",
    entityType: "user",
    entityId: user.id,
    details: { name: user.name, email: user.email, role: user.role },
  });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirect("/employees");
}

export async function updateEmployee(id: number, formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Unauthorized");

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password") || undefined,
    role: formData.get("role"),
    teamId: formData.get("teamId") ? Number(formData.get("teamId")) : null,
    jobTitle: formData.get("jobTitle") || null,
    monthlyTarget: formData.get("monthlyTarget") || 0,
    status: formData.get("status") || "active",
  };

  const data = employeeSchema.parse(raw);

  const updateData: any = {
    name: data.name,
    email: data.email.toLowerCase().trim(),
    role: data.role,
    teamId: data.teamId,
    jobTitle: data.jobTitle,
    monthlyTarget: data.monthlyTarget,
    status: data.status,
  };

  if (data.password && data.password.trim().length >= 6) {
    updateData.passwordHash = await bcrypt.hash(data.password, 12);
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
  });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: "updated employee",
    entityType: "user",
    entityId: id,
    details: { name: data.name, email: data.email },
  });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirect("/employees");
}
