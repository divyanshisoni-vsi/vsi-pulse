import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/email";
import {
  DEFAULT_VSI_LEAVE_POLICY,
  isHrOrAdminAccess,
  normalizeEmploymentTier,
  normalizePolicyConfig,
} from "@/lib/leave-policy";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionEmail = session.user.email.toLowerCase().trim();

    const [
      users,
      dailyLogs,
      attendanceRecords,
      kpis,
      alerts,
      auditLogs,
      leavePolicyRow,
      leaveRequestRows,
      publicHolidayRows,
    ] = await Promise.all([
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
      prisma.leavePolicyConfig.findFirst({
        orderBy: { id: "asc" },
      }),
      prisma.leaveRequest.findMany({
        include: {
          user: { select: { name: true, team: { select: { name: true } }, employmentType: true } },
          reviewer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.publicHoliday.findMany({
        orderBy: { date: "asc" },
      }),
    ]);

    const currentDbUser = users.find((u) => u.email.toLowerCase() === sessionEmail);
    const isAdminUser =
      currentDbUser?.role === "admin" ||
      (currentDbUser?.role as string) === "manager" ||
      session?.user?.role?.toLowerCase() === "admin";
    const isHrDepartment =
      (currentDbUser?.team?.name &&
        isHrOrAdminAccess({ role: "employee", teamName: currentDbUser.team.name })) ||
      isHrOrAdminAccess({ role: "employee", teamName: session?.user?.teamName });
    const canManageLeave = Boolean(isAdminUser || isHrDepartment);

    let activePolicyRow = leavePolicyRow;
    if (!activePolicyRow) {
      activePolicyRow = await prisma.leavePolicyConfig.create({
        data: {
          policyTitle: DEFAULT_VSI_LEAVE_POLICY.policyTitle,
          effectiveDate: DEFAULT_VSI_LEAVE_POLICY.effectiveDate,
          issuedBy: DEFAULT_VSI_LEAVE_POLICY.issuedBy,
          approvedBy: DEFAULT_VSI_LEAVE_POLICY.approvedBy,
          standardWorkdayHours: DEFAULT_VSI_LEAVE_POLICY.standardWorkdayHours,
          carryForwardEnabled: DEFAULT_VSI_LEAVE_POLICY.carryForwardEnabled,
          requireThreeStepProcess: DEFAULT_VSI_LEAVE_POLICY.requireThreeStepProcess,
          blockLeaveOnNoticePeriod: DEFAULT_VSI_LEAVE_POLICY.blockLeaveOnNoticePeriod,
          unauthorizedDeductionMultiplier:
            DEFAULT_VSI_LEAVE_POLICY.unauthorizedDeductionMultiplier,
          shiftChangeMinNoticeHours: DEFAULT_VSI_LEAVE_POLICY.shiftChangeMinNoticeHours,
          leaveTypes: DEFAULT_VSI_LEAVE_POLICY.leaveTypes as any,
          guidelinesNotes: DEFAULT_VSI_LEAVE_POLICY.guidelinesNotes as any,
          updatedBy: sessionEmail || "system",
        },
      });
    }

    const leavePolicy = normalizePolicyConfig(activePolicyRow);

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
        employmentType: normalizeEmploymentTier(u.employmentType),
        onNoticePeriod: Boolean(u.onNoticePeriod),
        leaveQuotaOverrides:
          canManageLeave || u.email.toLowerCase() === sessionEmail
            ? u.leaveQuotaOverrides || null
            : null,
        target: u.monthlyTarget,
        done: verifiedDone,
        status: u.status === "active" ? "Active" : "Inactive",
      };
    });

    const visibleLeaveRows = canManageLeave
      ? leaveRequestRows
      : leaveRequestRows.filter((lr) => lr.userId === currentDbUser?.id);

    const leaveRequests = visibleLeaveRows.map((lr) => ({
      id: lr.id,
      userId: lr.userId,
      employeeName: lr.user?.name || `Emp #${lr.userId}`,
      employeeTeam: lr.user?.team?.name || "Operations",
      employmentType: normalizeEmploymentTier(lr.user?.employmentType),
      leaveTypeKey: lr.leaveTypeKey,
      leaveTypeName: lr.leaveTypeName,
      durationMode: lr.durationMode,
      startDate: lr.startDate.toISOString().split("T")[0],
      endDate: lr.endDate.toISOString().split("T")[0],
      hoursRequested: Number(lr.hoursRequested),
      reason: lr.reason,
      handoverNotes: lr.handoverNotes || "",
      documentRef: lr.documentRef || "",
      slackInformed: Boolean(lr.slackInformed),
      hrEmailSent: Boolean(lr.hrEmailSent),
      jibbleApplied: Boolean(lr.jibbleApplied),
      status: lr.status,
      isLwp: Boolean(lr.isLwp),
      penaltyMultiplier: Number(lr.penaltyMultiplier),
      policyWarnings: Array.isArray(lr.policyWarnings) ? lr.policyWarnings : [],
      reviewerNotes: lr.reviewerNotes || "",
      reviewedBy: lr.reviewedBy,
      reviewerName: lr.reviewer?.name || null,
      reviewedAt: lr.reviewedAt ? lr.reviewedAt.toISOString() : null,
      createdAt: lr.createdAt.toISOString(),
    }));

    const publicHolidays = publicHolidayRows.map((h) => ({
      id: h.id,
      date: h.date.toISOString().split("T")[0],
      name: h.name,
      type: h.type,
      syncedJibble: Boolean(h.syncedJibble),
      notes: h.notes || "",
    }));

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
        leavePolicy,
        leaveRequests,
        publicHolidays,
        permissions: {
          isAdmin: Boolean(isAdminUser),
          isHrDepartment: Boolean(isHrDepartment),
          canManageLeave,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, no-store",
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
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorEmail = session.user.email || getClientIp(req);

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

    const actorUser = await prisma.user.findUnique({
      where: { email: actorEmail.toLowerCase().trim() },
      include: { team: { select: { name: true } } },
    });
    if (!actorUser || actorUser.status !== "active") {
      return NextResponse.json({ error: "Active employee account not found." }, { status: 403 });
    }
    const isAdminActor =
      actorUser.role === "admin" || (actorUser.role as string) === "manager";
    const isHrOrAdminActor =
      isAdminActor ||
      isHrOrAdminAccess({ role: "employee", teamName: actorUser.team?.name });

    if (action === "saveRecord") {
      if (type === "logs") {
        const targetUserId = isAdminActor ? Number(record.employeeId) : actorUser.id;
        const statusMap: any = {
          Verified: "verified",
          "Needs clarification": "needs_clarification",
          Pending: "pending",
        };
        const logData: any = {
          logDate: new Date(record.date || new Date()),
          userId: targetUserId,
          activity: record.activity,
          quantity: Number(record.quantity) || 0,
          status: isAdminActor ? statusMap[record.status] || "pending" : "pending",
          source: record.source || "Manual",
          notes: record.notes !== undefined ? (record.notes ? String(record.notes) : null) : undefined,
        };
        if (logData.status === "verified") {
          logData.verifiedAt = new Date();
        }

        if (id) {
          if (!isAdminActor) {
            const existingLog = await prisma.dailyLog.findUnique({ where: { id } });
            if (!existingLog || existingLog.userId !== actorUser.id) {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
          }
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
        if (!isAdminActor) {
          return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
        }
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
          employmentType: normalizeEmploymentTier(record.employmentType),
          onNoticePeriod:
            record.onNoticePeriod === true || record.onNoticePeriod === "true",
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
          const rawPassword =
            record.password && record.password.trim().length > 0
              ? record.password.trim()
              : "VSI@2026";
          userData.passwordHash = await bcrypt.hash(rawPassword, 12);

          const newUser = await prisma.user.create({
            data: userData,
          });

          // Automatically dispatch welcome email with credentials via Google Workspace SMTP
          let emailSent = false;
          try {
            await sendWelcomeEmail({
              to: userData.email,
              name: userData.name,
              password: rawPassword,
              role: userData.jobTitle || "Team Member",
              team: team.name,
            });
            emailSent = true;
          } catch (mailErr) {
            console.error("Failed to send welcome email to new employee:", mailErr);
          }

          // Record audit log
          prisma.auditLog
            .create({
              data: {
                actorEmail,
                action: "Added Employee",
                entityType: "employees",
                entityId: newUser.id,
                details: {
                  name: newUser.name,
                  email: newUser.email,
                  role: newUser.jobTitle,
                  welcomeEmailSent: emailSent,
                },
              },
            })
            .catch(() => {});

          return NextResponse.json({
            success: true,
            welcomeEmailSent: emailSent,
            message: emailSent
              ? `Account created and login credentials dispatched to ${userData.email}`
              : `Account created for ${userData.email}.`,
          });
        }
      } else if (type === "kpis") {
        if (!isAdminActor) {
          return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
        }
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
        const attUserId = isHrOrAdminActor ? Number(record.employeeId) : actorUser.id;
        const attDate = new Date(`${String(record.date || new Date().toISOString().split("T")[0]).split("T")[0]}T00:00:00Z`);
        const attHours = Number(record.hours) >= 0 ? Number(record.hours) : 8;
        const attStatus = statusMap[record.status] || "present";
        if (id) {
          if (!isHrOrAdminActor) {
            const existingAtt = await prisma.attendance.findUnique({ where: { id } });
            if (!existingAtt || existingAtt.userId !== actorUser.id) {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
          }
          await prisma.attendance.update({
            where: { id },
            data: {
              date: attDate,
              userId: attUserId,
              hoursWorked: attHours,
              status: attStatus,
            },
          });
        } else {
          await prisma.attendance.upsert({
            where: { userId_date: { userId: attUserId, date: attDate } },
            create: {
              date: attDate,
              userId: attUserId,
              hoursWorked: attHours,
              status: attStatus,
            },
            update: {
              hoursWorked: attHours,
              status: attStatus,
            },
          });
        }
      } else if (type === "alerts") {
        if (!isAdminActor) {
          return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
        }
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
      if (!isAdminActor) {
        return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
      }
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
      if (!isAdminActor) {
        return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
      }
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
      if (type === "attendance") {
        if (!isHrOrAdminActor) {
          return NextResponse.json({ error: "HR or Admin permission required." }, { status: 403 });
        }
      } else if (type === "logs") {
        if (!isAdminActor) {
          const existingLog = await prisma.dailyLog.findUnique({ where: { id } });
          if (!existingLog || existingLog.userId !== actorUser.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      } else if (!isAdminActor) {
        return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
      }
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
      if (!isAdminActor) {
        return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
      }
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
