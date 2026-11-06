import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await auth();

    const [users, dailyLogs, attendanceRecords, kpis, alerts, auditLogs] = await Promise.all([
      prisma.user.findMany({
        include: {
          team: { select: { name: true } },
          dailyLogs: {
            where: { status: "verified" },
            select: { quantity: true },
          },
        },
        orderBy: { id: "asc" },
      }),
      prisma.dailyLog.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { logDate: "desc" },
      }),
      prisma.attendance.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.kpiStandard.findMany({
        include: { team: { select: { name: true } } },
        orderBy: { id: "asc" },
      }),
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const employees = users.map((u) => {
      const verifiedDone = u.dailyLogs.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
      const accessRole =
        u.role === "admin" || (u.role as string) === "manager" ? "Admin" : "Employee";

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        team: u.team?.name || "Operations",
        role: u.jobTitle || "Team Member",
        accessRole,
        target: u.monthlyTarget,
        done: verifiedDone,
        status: u.status === "active" ? "Active" : "Inactive",
      };
    });

    const logs = dailyLogs.map((l) => ({
      id: l.id,
      date: l.logDate.toISOString().split("T")[0],
      employeeId: l.userId,
      activity: l.activity,
      quantity: l.quantity ? Number(l.quantity) : 0,
      status:
        l.status === "verified"
          ? "Verified"
          : l.status === "needs_clarification"
          ? "Needs clarification"
          : "Pending",
      source: l.source || "Web Portal",
      notes: l.notes || "",
      verifiedBy: l.verifiedBy,
      verifiedAt: l.verifiedAt ? l.verifiedAt.toISOString() : null,
    }));

    const attendance = attendanceRecords.map((a) => ({
      id: a.id,
      date: a.date.toISOString().split("T")[0],
      employeeId: a.userId,
      hours: Number(a.hoursWorked),
      status: a.status.charAt(0).toUpperCase() + a.status.slice(1),
    }));

    const kpiList = kpis.map((k) => ({
      id: k.id,
      team: k.team.name,
      name: k.name,
      target: Number(k.targetValue),
      weight: k.weightPercent,
    }));

    const alertList = alerts.map((a) => ({
      id: a.id,
      type: a.type,
      text: a.message,
      status: a.status === "open" ? "Open" : "Resolved",
    }));

    const auditList = auditLogs.map((a) => ({
      id: a.id,
      at: a.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "medium" }),
      actor: a.actorEmail,
      action: a.action,
      details: a.details ? JSON.stringify(a.details) : "",
    }));

    return NextResponse.json(
      {
        employees,
        logs,
        attendance,
        kpis: kpiList,
        alerts: alertList,
        audit: auditList,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
        },
      }
    );
  } catch (err: any) {
    console.error("GET /api/data error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const actorEmail = session?.user?.email || getClientIp(req);

    // Rate limit: Max 60 modifications per minute per user/ip
    const writeLimit = await checkRateLimit(`data-write:${actorEmail}`, 60, 60);
    if (!writeLimit.success) {
      return rateLimitResponse(
        `Action threshold reached. Please wait ${writeLimit.retryAfterSeconds}s before submitting more changes.`,
        writeLimit
      );
    }

    const body = await req.json();
    const { action, type, record, id } = body;

    if (action === "saveRecord") {
      if (type === "logs") {
        const statusMap: any = {
          Verified: "verified",
          "Needs clarification": "needs_clarification",
          Pending: "pending",
        };
        const logData: any = {
          logDate: new Date(record.date || new Date()),
          userId: Number(record.employeeId),
          activity: record.activity,
          quantity: Number(record.quantity) || 0,
          status: statusMap[record.status] || "pending",
          source: record.source || "Manual",
          notes: record.notes !== undefined ? (record.notes ? String(record.notes) : null) : undefined,
        };
        if (record.status === "Verified") {
          logData.verifiedAt = new Date();
        }

        if (id) {
          await prisma.dailyLog.update({
            where: { id },
            data: logData,
          });
        } else {
          await prisma.dailyLog.create({
            data: logData,
          });
        }
      } else if (type === "employees") {
        let team = await prisma.team.findUnique({ where: { name: record.team } });
        if (!team) {
          team = await prisma.team.create({ data: { name: record.team } });
        }

        // Map selected access role: Admin (Manager) vs Employee
        const assignedRole = record.accessRole === "Admin" ? "admin" : "employee";

        const userData: any = {
          name: record.name,
          email: record.email.toLowerCase().trim(),
          jobTitle: record.role,
          role: assignedRole,
          teamId: team.id,
          monthlyTarget: Number(record.target) || 0,
          status: record.status === "Inactive" ? "inactive" : "active",
        };

        if (id) {
          if (record.password && record.password.trim().length > 0) {
            userData.passwordHash = await bcrypt.hash(record.password.trim(), 12);
          }
          await prisma.user.update({
            where: { id },
            data: userData,
          });
        } else {
          const rawPassword = record.password && record.password.trim().length > 0
            ? record.password.trim()
            : "VSI@2026";
          userData.passwordHash = await bcrypt.hash(rawPassword, 12);

          await prisma.user.create({
            data: userData,
          });
        }
      } else if (type === "kpis") {
        let team = await prisma.team.findUnique({ where: { name: record.team } });
        if (!team) team = await prisma.team.create({ data: { name: record.team } });
        if (id) {
          await prisma.kpiStandard.update({
            where: { id },
            data: {
              teamId: team.id,
              name: record.name,
              targetValue: Number(record.target) || 0,
              weightPercent: Number(record.weight) || 100,
            },
          });
        } else {
          await prisma.kpiStandard.create({
            data: {
              teamId: team.id,
              name: record.name,
              targetValue: Number(record.target) || 0,
              weightPercent: Number(record.weight) || 100,
            },
          });
        }
      } else if (type === "attendance") {
        const statusMap: any = {
          Present: "present",
          Leave: "leave",
          Absent: "absent",
          "Half day": "half_day",
        };
        if (id) {
          await prisma.attendance.update({
            where: { id },
            data: {
              date: new Date(record.date),
              userId: Number(record.employeeId),
              hoursWorked: Number(record.hours) || 8,
              status: statusMap[record.status] || "present",
            },
          });
        } else {
          await prisma.attendance.create({
            data: {
              date: new Date(record.date || new Date()),
              userId: Number(record.employeeId),
              hoursWorked: Number(record.hours) || 8,
              status: statusMap[record.status] || "present",
            },
          });
        }
      } else if (type === "alerts") {
        if (id) {
          await prisma.alert.update({
            where: { id },
            data: {
              type: record.type,
              message: record.text,
              status: record.status.toLowerCase(),
            },
          });
        } else {
          await prisma.alert.create({
            data: {
              type: record.type,
              message: record.text,
              status: record.status.toLowerCase(),
            },
          });
        }
      }

      // Record audit log
      try {
        await prisma.auditLog.create({
          data: {
            actorEmail,
            action: id ? `Updated ${type}` : `Added ${type}`,
            entityType: type,
            entityId: id || undefined,
            details: record as any,
          },
        });
      } catch (auditErr) {
        console.error("Audit log error:", auditErr);
      }

      return NextResponse.json({ success: true });
    }

    if (action === "verifyLog") {
      const { id } = body;
      await prisma.dailyLog.update({
        where: { id: Number(id) },
        data: {
          status: "verified",
          verifiedAt: new Date(),
        },
      });

      prisma.auditLog.create({
        data: {
          actorEmail,
          action: "Verified Daily Log",
          entityType: "daily_log",
          entityId: Number(id),
          details: { verifiedAt: new Date().toISOString() },
        },
      }).catch(() => {});

      return NextResponse.json({ success: true, message: "Log verified" });
    }

    if (action === "requestClarification") {
      const { id, notes } = body;
      const updatedLog = await prisma.dailyLog.update({
        where: { id: Number(id) },
        data: {
          status: "needs_clarification",
          notes: notes || "Clarification requested by Manager / Admin.",
        },
        include: { user: true },
      });

      // Create an alert so the system highlights it
      if (updatedLog.user) {
        prisma.alert.create({
          data: {
            type: "Clarification Needed",
            message: `${updatedLog.user.name}: ${notes || "Additional details requested for daily log."}`,
            status: "open",
            relatedUserId: updatedLog.userId,
            relatedLogId: updatedLog.id,
          },
        }).catch(() => {});
      }

      prisma.auditLog.create({
        data: {
          actorEmail,
          action: "Requested Log Clarification",
          entityType: "daily_log",
          entityId: Number(id),
          details: { notes },
        },
      }).catch(() => {});

      return NextResponse.json({ success: true, message: "Clarification requested" });
    }

    if (action === "removeRecord") {
      if (type === "logs") await prisma.dailyLog.delete({ where: { id } });
      if (type === "employees") await prisma.user.delete({ where: { id } });
      if (type === "kpis") await prisma.kpiStandard.delete({ where: { id } });
      if (type === "attendance") await prisma.attendance.delete({ where: { id } });
      if (type === "alerts") await prisma.alert.delete({ where: { id } });

      try {
        await prisma.auditLog.create({
          data: {
            actorEmail,
            action: `Deleted ${type}`,
            entityType: type,
            entityId: id,
          },
        });
      } catch (auditErr) {
        console.error("Audit log error:", auditErr);
      }

      return NextResponse.json({ success: true });
    }

    if (action === "toggleAlert") {
      const alert = await prisma.alert.findUnique({ where: { id } });
      if (alert) {
        const nextStatus = alert.status === "open" ? "resolved" : "open";
        await prisma.alert.update({
          where: { id },
          data: { status: nextStatus },
        });

        try {
          await prisma.auditLog.create({
            data: {
              actorEmail,
              action: `Alert marked as ${nextStatus}`,
              entityType: "alert",
              entityId: id,
            },
          });
        } catch (auditErr) {
          console.error("Audit log error:", auditErr);
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/data error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
