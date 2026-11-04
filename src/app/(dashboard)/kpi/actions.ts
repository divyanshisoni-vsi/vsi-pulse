"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { writeAudit } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const kpiSchema = z.object({
  teamId: z.coerce.number().int().positive(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  targetValue: z.coerce.number().positive(),
  unit: z.string().default("units"),
  weightPercent: z.coerce.number().int().min(1).max(100).default(100),
});

export async function createKpiStandard(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Unauthorized");

  const raw = {
    teamId: formData.get("teamId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    targetValue: formData.get("targetValue"),
    unit: formData.get("unit") || "units",
    weightPercent: formData.get("weightPercent") || 100,
  };

  const data = kpiSchema.parse(raw);

  const kpi = await prisma.kpiStandard.create({
    data: {
      teamId: data.teamId,
      name: data.name,
      description: data.description,
      targetValue: data.targetValue,
      unit: data.unit,
      weightPercent: data.weightPercent,
    },
  });

  await writeAudit({
    actorId: parseInt(session.user.id),
    actorEmail: session.user.email!,
    action: "created KPI standard",
    entityType: "kpi_standard",
    entityId: kpi.id,
    details: { name: data.name, targetValue: data.targetValue },
  });

  revalidatePath("/kpi");
  revalidatePath("/dashboard");
  redirect("/kpi");
}
