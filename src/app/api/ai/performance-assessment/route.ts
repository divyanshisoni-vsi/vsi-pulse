import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { generateAiJson, MissingAiKeyError } from "@/lib/ai-provider";
import {
  computeEmployeePeriodMetrics,
  isValidIsoDate,
  PerformanceDatePreset,
  resolvePerformanceRange,
} from "@/lib/performance-analytics";

export const maxDuration = 30;

const VALID_PRESETS = new Set<PerformanceDatePreset>([
  "all",
  "7d",
  "15d",
  "30d",
  "this_month",
  "custom",
]);

function normalizeLogStatus(status: string): string {
  if (status === "verified") return "Verified";
  if (status === "needs_clarification") return "Needs clarification";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function normalizeAttendanceStatus(status: string): string {
  if (status === "half_day") return "Half day";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function normalizeStringArray(val: unknown, max = 5): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function normalizePriority(val: unknown): "High" | "Medium" | "Low" {
  const s = typeof val === "string" ? val.toLowerCase().trim() : "";
  if (s === "high") return "High";
  if (s === "low") return "Low";
  return "Medium";
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionEmail = session.user.email.toLowerCase().trim();
    const limit = await checkRateLimit(
      `ai-assess:${sessionEmail || getClientIp(req)}`,
      15,
      60
    );
    if (!limit.success) {
      return rateLimitResponse(
        `AI assessment limit reached. Wait ${limit.retryAfterSeconds}s and retry.`,
        limit
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode: "individual" | "team" =
      body?.mode === "team" ? "team" : "individual";
    const presetRaw = String(body?.preset || "all") as PerformanceDatePreset;
    const preset: PerformanceDatePreset = VALID_PRESETS.has(presetRaw)
      ? presetRaw
      : "all";
    const customStart = isValidIsoDate(body?.startDate) ? body.startDate : null;
    const customEnd = isValidIsoDate(body?.endDate) ? body.endDate : null;
    const todayIso = isValidIsoDate(body?.todayIso) ? body.todayIso : undefined;

    const range = resolvePerformanceRange(preset, customStart, customEnd, todayIso);

    const actorDbUser = await prisma.user.findUnique({
      where: { email: sessionEmail },
      include: { team: { select: { name: true } } },
    });

    if (!actorDbUser) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const isAdminOrManager =
      actorDbUser.role === "admin" ||
      (actorDbUser.role as string) === "manager" ||
      session.user.role?.toLowerCase() === "admin";

    if (mode === "team" && !isAdminOrManager) {
      return NextResponse.json(
        { error: "Forbidden: Team-wide AI reviews require Admin or Manager access." },
        { status: 403 }
      );
    }

    const requestedEmployeeId = Number(body?.employeeId);
    const targetEmployeeId =
      Number.isFinite(requestedEmployeeId) && requestedEmployeeId > 0
        ? requestedEmployeeId
        : actorDbUser.id;

    if (
      mode === "individual" &&
      !isAdminOrManager &&
      targetEmployeeId !== actorDbUser.id
    ) {
      return NextResponse.json(
        { error: "Forbidden: You can only run AI performance assessment for your own profile." },
        { status: 403 }
      );
    }

    const dateFilter =
      range.startDate && range.endDate
        ? {
            gte: new Date(`${range.startDate}T00:00:00.000Z`),
            lte: new Date(`${range.endDate}T23:59:59.999Z`),
          }
        : undefined;

    if (mode === "individual") {
      const [targetUser, userLogs, userAttendance, kpis, approvedLeaves] =
        await Promise.all([
          prisma.user.findUnique({
            where: { id: targetEmployeeId },
            include: {
              team: { select: { id: true, name: true } },
            },
          }),
          prisma.dailyLog.findMany({
            where: {
              userId: targetEmployeeId,
              ...(dateFilter ? { logDate: dateFilter } : {}),
            },
            orderBy: { logDate: "desc" },
            take: 60,
          }),
          prisma.attendance.findMany({
            where: {
              userId: targetEmployeeId,
              ...(dateFilter ? { date: dateFilter } : {}),
            },
            orderBy: { date: "desc" },
            take: 60,
          }),
          prisma.kpiStandard.findMany({
            orderBy: { id: "asc" },
          }),
          prisma.leaveRequest.findMany({
            where: {
              userId: targetEmployeeId,
              ...(dateFilter
                ? {
                    startDate: { lte: new Date(`${range.endDate}T23:59:59.999Z`) },
                    endDate: { gte: new Date(`${range.startDate}T00:00:00.000Z`) },
                  }
                : {}),
            },
            orderBy: { startDate: "desc" },
            take: 20,
          }),
        ]);

      if (!targetUser) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      const teamName = targetUser.team?.name || "Operations";
      const teamKpis = kpis.filter((k) => k.teamId === targetUser.teamId);

      // Compute verified all-time baseline for "all" preset parity
      const allTimeVerified = await prisma.dailyLog.aggregate({
        where: { userId: targetUser.id, status: "verified" },
        _sum: { quantity: true },
      });

      const mappedEmployee = {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        team: teamName,
        role: targetUser.jobTitle || "Team Member",
        target: targetUser.monthlyTarget,
        done: Number(allTimeVerified._sum.quantity || 0),
        status: targetUser.status === "active" ? "Active" : "Inactive",
        employmentType: targetUser.employmentType,
      };

      const mappedLogs = userLogs.map((l) => ({
        id: l.id,
        date: l.logDate.toISOString().split("T")[0],
        employeeId: l.userId,
        activity: l.activity,
        quantity: Number(l.quantity || 0),
        status: normalizeLogStatus(l.status),
        source: l.source || "Web Portal",
        notes: l.notes || "",
      }));

      const mappedAttendance = userAttendance.map((a) => ({
        id: a.id,
        date: a.date.toISOString().split("T")[0],
        employeeId: a.userId,
        hours: Number(a.hoursWorked),
        status: normalizeAttendanceStatus(a.status),
      }));

      const metrics = computeEmployeePeriodMetrics(
        mappedEmployee,
        mappedLogs,
        mappedAttendance,
        range
      );

      const recentLogDigest = mappedLogs.slice(0, 25).map((l) => ({
        date: l.date,
        status: l.status,
        units: l.quantity,
        activity: l.activity.slice(0, 220),
        managerFeedback: l.notes ? l.notes.slice(0, 140) : "",
      }));

      const prompt = `You are a senior performance coach & HR evaluator at Virtual Solutions India (VSI Pulse).
Analyze this employee's VERIFIED operational data strictly for the selected evaluation window and tell management & the employee:
1) Overall performance assessment
2) Exact strengths evidenced in their logs
3) Specific areas where they need to improve and what concrete habits/skills/KPIs they should work on next
4) Whether they are ready for recognition / a performance certificate right now.

CRITICAL GROUNDING RULES:
- Base every claim strictly on the data below. Do NOT invent tasks, client names, or numbers not listed here.
- If "totalLogsCount" is 0, clearly explain that no daily activity logs exist in the selected date window (${range.label}) and focus recommendations on logging discipline, aligning with department KPI targets, and reaching the daily required pace (${metrics.requiredPerDay} units/day).
- Notice any logs with status "Needs clarification" or "Pending" or low verification rate, and call out exact improvements needed (for example: providing concrete proof/ticket IDs in logs, increasing daily output from ${metrics.pacePerActiveDay} to ${metrics.requiredPerDay} units/day, or maintaining regular attendance).

Evaluation Window: ${range.label}
Employee Profile:
- Name: ${mappedEmployee.name}
- Department: ${teamName}
- Designation: ${mappedEmployee.role}
- Employment Tier: ${targetUser.employmentType}${targetUser.onNoticePeriod ? " (Currently on Notice Period)" : ""}

Computed Period KPI Snapshot:
- Period Target (prorated from ${metrics.monthlyTarget}/mo): ${metrics.periodTarget} units
- Verified Units Delivered: ${metrics.periodDone} units (${metrics.achievementPct}% of target, delta: ${metrics.paceDeltaUnits >= 0 ? "+" : ""}${metrics.paceDeltaUnits} units)
- Required Pace: ${metrics.requiredPerDay} units/day | Observed Pace (on active logged days): ${metrics.pacePerActiveDay} units/day
- Daily Logs: ${metrics.totalLogsCount} total (${metrics.verifiedLogsCount} Verified, ${metrics.pendingLogsCount} Pending verification, ${metrics.clarificationLogsCount} Flagged Needs Clarification)
- Log Verification Rate: ${metrics.verificationRatePct}% | Clarification Rate: ${metrics.clarificationRatePct}%
- Attendance in Window: ${metrics.presentDays} Present, ${metrics.halfDays} Half-day, ${metrics.leaveDays} Leave, ${metrics.absentDays} Absent (${metrics.totalDutyHours} total hrs)
- Leave Requests overlapping window: ${approvedLeaves.map((lv) => `${lv.leaveTypeName} (${lv.status}, ${lv.hoursRequested}h)`).join("; ") || "None"}

Department KPI Standards (${teamName}):
${teamKpis.length ? teamKpis.map((k) => `- ${k.name}: target ${Number(k.targetValue)} ${k.unit} (weight ${k.weightPercent}%)`).join("\n") : "- Standard verified unit output target"}

Daily Activity Logs Sample (most recent first, max 25):
${recentLogDigest.length ? JSON.stringify(recentLogDigest, null, 2) : "[]"}

Return ONLY valid JSON matching this exact structure:
{
  "overallRating": "Exceeding Expectations" | "Strong Performer" | "Developing / On Track" | "Needs Improvement" | "Insufficient Data",
  "readinessTag": "short 2-4 word status badge",
  "executiveSummary": "2-3 clear sentences summarizing performance in this exact date window",
  "strengths": ["3-4 concise bullet strings grounded in the data"],
  "areasToImprove": ["3-4 concrete weaknesses or bottlenecks identified in metrics/logs"],
  "focusTopics": ["3-4 specific skills, habits, or KPI areas this person should actively work on"],
  "actionPlan": [
    {
      "focusArea": "short topic title",
      "recommendation": "clear, practical next step",
      "priority": "High" | "Medium" | "Low"
    }
  ],
  "certificateGuidance": "1-2 sentences on certificate eligibility / recognition milestone for this date window"
}`;

      const { provider, parsed } = await generateAiJson<any>({
        prompt,
        timeoutBudgetMs: 9500,
      });

      const allowedRatings = new Set([
        "Exceeding Expectations",
        "Strong Performer",
        "Developing / On Track",
        "Needs Improvement",
        "Insufficient Data",
      ]);
      const overallRating = allowedRatings.has(parsed?.overallRating)
        ? parsed.overallRating
        : metrics.totalLogsCount === 0
        ? "Insufficient Data"
        : metrics.achievementPct >= 90
        ? "Exceeding Expectations"
        : metrics.achievementPct >= 70
        ? "Strong Performer"
        : metrics.achievementPct >= 45
        ? "Developing / On Track"
        : "Needs Improvement";

      const actionPlan = Array.isArray(parsed?.actionPlan)
        ? parsed.actionPlan
            .filter((item: any) => item && typeof item.recommendation === "string")
            .slice(0, 4)
            .map((item: any) => ({
              focusArea: String(item.focusArea || "Performance Focus").trim(),
              recommendation: String(item.recommendation || "").trim(),
              priority: normalizePriority(item.priority),
            }))
        : [];

      return NextResponse.json({
        success: true,
        mode: "individual",
        provider,
        range,
        employee: {
          id: mappedEmployee.id,
          name: mappedEmployee.name,
          email: mappedEmployee.email,
          team: mappedEmployee.team,
          role: mappedEmployee.role,
          employmentType: targetUser.employmentType,
        },
        metrics,
        assessment: {
          overallRating,
          readinessTag:
            typeof parsed?.readinessTag === "string" && parsed.readinessTag.trim()
              ? parsed.readinessTag.trim().slice(0, 40)
              : metrics.performanceBand,
          executiveSummary:
            typeof parsed?.executiveSummary === "string" &&
            parsed.executiveSummary.trim()
              ? parsed.executiveSummary.trim()
              : `Analyzed ${metrics.totalLogsCount} daily logs across ${range.label}.`,
          strengths: normalizeStringArray(parsed?.strengths, 4),
          areasToImprove: normalizeStringArray(parsed?.areasToImprove, 4),
          focusTopics: normalizeStringArray(parsed?.focusTopics, 4),
          actionPlan,
          certificateGuidance:
            typeof parsed?.certificateGuidance === "string" &&
            parsed.certificateGuidance.trim()
              ? parsed.certificateGuidance.trim()
              : metrics.achievementPct > 0
              ? "Eligible for Certificate of Achievement based on verified output in this window."
              : "Record and verify daily deliverable logs to unlock Certificate eligibility.",
        },
      });
    }

    // Team / Leaderboard Review (Admin & Manager only)
    const [allUsers, periodLogs, periodAttendance] = await Promise.all([
      prisma.user.findMany({
        where: { status: "active" },
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
        where: dateFilter ? { logDate: dateFilter } : undefined,
        orderBy: { logDate: "desc" },
        take: 250,
      }),
      prisma.attendance.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        orderBy: { date: "desc" },
        take: 250,
      }),
    ]);

    const mappedLogs = periodLogs.map((l) => ({
      id: l.id,
      date: l.logDate.toISOString().split("T")[0],
      employeeId: l.userId,
      activity: l.activity,
      quantity: Number(l.quantity || 0),
      status: normalizeLogStatus(l.status),
      source: l.source || "Web Portal",
      notes: l.notes || "",
    }));

    const mappedAttendance = periodAttendance.map((a) => ({
      id: a.id,
      date: a.date.toISOString().split("T")[0],
      employeeId: a.userId,
      hours: Number(a.hoursWorked),
      status: normalizeAttendanceStatus(a.status),
    }));

    const teamMetrics = allUsers
      .map((u) => {
        const allTimeDone = u.dailyLogs.reduce(
          (sum, dl) => sum + Number(dl.quantity || 0),
          0
        );
        return computeEmployeePeriodMetrics(
          {
            id: u.id,
            name: u.name,
            email: u.email,
            team: u.team?.name || "Operations",
            role: u.jobTitle || "Team Member",
            target: u.monthlyTarget,
            done: allTimeDone,
            status: u.status === "active" ? "Active" : "Inactive",
            employmentType: u.employmentType,
          },
          mappedLogs,
          mappedAttendance,
          range
        );
      })
      .sort((a, b) => b.achievementPct - a.achievementPct || b.periodDone - a.periodDone);

    const overallAvgPct = teamMetrics.length
      ? Math.round(
          teamMetrics.reduce((acc, m) => acc + m.achievementPct, 0) /
            teamMetrics.length
        )
      : 0;
    const totalVerifiedUnits = teamMetrics.reduce((acc, m) => acc + m.periodDone, 0);
    const totalPeriodTarget = teamMetrics.reduce((acc, m) => acc + m.periodTarget, 0);
    const activeClarifications = teamMetrics.reduce(
      (acc, m) => acc + m.clarificationLogsCount,
      0
    );

    const rosterDigest = teamMetrics.slice(0, 20).map((m) => ({
      name: m.name,
      team: m.team,
      role: m.role,
      periodDone: m.periodDone,
      periodTarget: m.periodTarget,
      achievementPct: m.achievementPct,
      verifiedLogs: m.verifiedLogsCount,
      pendingLogs: m.pendingLogsCount,
      clarificationLogs: m.clarificationLogsCount,
      presentDays: m.presentDays,
      totalDutyHours: m.totalDutyHours,
      band: m.performanceBand,
    }));

    const teamPrompt = `You are a COO / Executive Performance Advisor for Virtual Solutions India (VSI Pulse).
Review the workforce Leaderboard standings for "${range.label}" and give managers:
1) An objective team health assessment
2) Top performance highlights
3) Specific employees or departments who need coaching and exact areas they must improve / work on
4) Practical management process recommendations.

STRICT GROUNDING RULES:
- Cite ONLY employee names, teams, and metrics present in the dataset below. Never fabricate data.
- Focus on actionable clarity: if someone has pending/clarification logs, zero logs, or low target pacing, state specifically what they should work on.

Workforce Summary (${range.label}):
- Active Personnel Evaluated: ${teamMetrics.length}
- Average Period Achievement: ${overallAvgPct}%
- Total Verified Units: ${totalVerifiedUnits} / ${totalPeriodTarget}
- Open Clarification Flags in Window: ${activeClarifications}

Leaderboard Dataset (top 20 sorted by achievement %):
${JSON.stringify(rosterDigest, null, 2)}

Return ONLY valid JSON matching this schema:
{
  "teamHealthRating": "High Performing" | "Steady" | "Needs Coaching Focus",
  "executiveSummary": "2-3 concise sentences summarizing team standings across the date range",
  "topHighlights": ["3-4 strengths/achievements observed across teams"],
  "improvementPriorities": [
    {
      "employeeName": "exact name from dataset",
      "team": "department name",
      "gapArea": "specific bottleneck or KPI shortfall",
      "whatToWorkOn": "concrete focus item or habit to coach on",
      "priority": "High" | "Medium" | "Low"
    }
  ],
  "managerRecommendations": ["3 concise workflow / target / review recommendations"]
}`;

    const { provider, parsed } = await generateAiJson<any>({
      prompt: teamPrompt,
      timeoutBudgetMs: 9500,
    });

    const improvementPriorities = Array.isArray(parsed?.improvementPriorities)
      ? parsed.improvementPriorities
          .filter((item: any) => item && typeof item.employeeName === "string")
          .slice(0, 6)
          .map((item: any) => ({
            employeeName: String(item.employeeName).trim(),
            team: String(item.team || "Operations").trim(),
            gapArea: String(item.gapArea || "Target pacing").trim(),
            whatToWorkOn: String(item.whatToWorkOn || "").trim(),
            priority: normalizePriority(item.priority),
          }))
      : [];

    return NextResponse.json({
      success: true,
      mode: "team",
      provider,
      range,
      teamStandingsSummary: {
        totalEmployees: teamMetrics.length,
        overallAvgPct,
        totalVerifiedUnits,
        totalPeriodTarget,
        activeClarifications,
      },
      assessment: {
        teamHealthRating:
          typeof parsed?.teamHealthRating === "string" &&
          parsed.teamHealthRating.trim()
            ? parsed.teamHealthRating.trim()
            : overallAvgPct >= 80
            ? "High Performing"
            : overallAvgPct >= 55
            ? "Steady"
            : "Needs Coaching Focus",
        executiveSummary:
          typeof parsed?.executiveSummary === "string" &&
          parsed.executiveSummary.trim()
            ? parsed.executiveSummary.trim()
            : `Evaluated ${teamMetrics.length} active personnel across ${range.label}.`,
        topHighlights: normalizeStringArray(parsed?.topHighlights, 4),
        improvementPriorities,
        managerRecommendations: normalizeStringArray(parsed?.managerRecommendations, 4),
      },
    });
  } catch (err: any) {
    if (err instanceof MissingAiKeyError) {
      return NextResponse.json(
        { error: err.message, code: "MISSING_AI_KEY" },
        { status: 503 }
      );
    }
    console.error("POST /api/ai/performance-assessment error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate performance assessment." },
      { status: 500 }
    );
  }
}
