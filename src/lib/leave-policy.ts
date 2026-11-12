export type EmploymentTier =
  | "manager"
  | "full_time"
  | "part_time"
  | "intern"
  | "probationary";

export const EMPLOYMENT_TIER_OPTIONS: Array<{
  value: EmploymentTier;
  label: string;
  shortLabel: string;
}> = [
  { value: "manager", label: "Manager", shortLabel: "Manager" },
  { value: "full_time", label: "Full-Time Employee", shortLabel: "Full-Time" },
  { value: "part_time", label: "Part-Time Employee", shortLabel: "Part-Time" },
  { value: "intern", label: "Intern", shortLabel: "Intern" },
  { value: "probationary", label: "Probationary Employee", shortLabel: "Probationary" },
];

export type LeaveTypeRule = {
  key: string;
  name: string;
  quotas: Record<EmploymentTier, number>;
  minAdvanceDays: number;
  multiDayMinAdvanceDays: number;
  preferredAdvanceDays?: number;
  requiresDocument: boolean;
  documentLabel: string;
  guideline: string;
  color: string;
  active: boolean;
};

export type LeavePolicyGuidelines = {
  annualEntitlement: string;
  approvalProcess: string;
  attendanceShift: string;
  approvalConditions: string;
  unauthorizedLwp: string;
  halfDay: string;
  noticePeriod: string;
  holidays: string;
  compliance: string;
};

export type LeavePolicyData = {
  id?: number;
  policyTitle: string;
  effectiveDate: string;
  issuedBy: string;
  approvedBy: string;
  standardWorkdayHours: number;
  carryForwardEnabled: boolean;
  requireThreeStepProcess: boolean;
  blockLeaveOnNoticePeriod: boolean;
  unauthorizedDeductionMultiplier: number;
  shiftChangeMinNoticeHours: number;
  leaveTypes: LeaveTypeRule[];
  guidelinesNotes: LeavePolicyGuidelines;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export type EmployeeLeaveOverrides = {
  customQuotas?: Record<string, number>;
  carryForwardHours?: Record<string, number>;
  lwpDaysAdjustment?: number;
  note?: string;
};

export type LeaveRequestRecord = {
  id: number;
  userId: number;
  employeeName?: string;
  employeeTeam?: string;
  employmentType?: EmploymentTier;
  leaveTypeKey: string;
  leaveTypeName: string;
  durationMode: "full_day" | "half_day" | "hours" | "shift_change";
  startDate: string;
  endDate: string;
  hoursRequested: number;
  reason: string;
  handoverNotes: string;
  documentRef: string;
  slackInformed: boolean;
  hrEmailSent: boolean;
  jibbleApplied: boolean;
  status: "pending" | "approved" | "rejected" | "lwp" | "unauthorized" | "cancelled";
  isLwp: boolean;
  penaltyMultiplier: number;
  policyWarnings: string[];
  reviewerNotes: string;
  reviewedBy?: number | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type PublicHolidayRecord = {
  id: number;
  date: string;
  name: string;
  type: string;
  syncedJibble: boolean;
  notes: string;
};

export const DEFAULT_VSI_LEAVE_POLICY: LeavePolicyData = {
  policyTitle: "Virtual Solutions India (VSI) - HR Policy",
  effectiveDate: "2026-07-13",
  issuedBy: "HR Department",
  approvedBy: "Amit Jain (Managing Director, Virtual Solutions India)",
  standardWorkdayHours: 8,
  carryForwardEnabled: false,
  requireThreeStepProcess: true,
  blockLeaveOnNoticePeriod: true,
  unauthorizedDeductionMultiplier: 1.5,
  shiftChangeMinNoticeHours: 2,
  leaveTypes: [
    {
      key: "vacation",
      name: "Vacation / Long Leave",
      quotas: {
        manager: 40,
        full_time: 24,
        part_time: 0,
        intern: 0,
        probationary: 0,
      },
      minAdvanceDays: 15,
      multiDayMinAdvanceDays: 15,
      preferredAdvanceDays: 30,
      requiresDocument: false,
      documentLabel: "",
      guideline: "Apply at least 15 days in advance (30 days preferred).",
      color: "#2563eb",
      active: true,
    },
    {
      key: "casual",
      name: "Casual Leave",
      quotas: {
        manager: 20,
        full_time: 14,
        part_time: 0,
        intern: 0,
        probationary: 0,
      },
      minAdvanceDays: 2,
      multiDayMinAdvanceDays: 7,
      requiresDocument: false,
      documentLabel: "",
      guideline:
        "For 1 day: apply 2–3 working days in advance. For 2–3 days: apply at least 7 days in advance.",
      color: "#0ea5e9",
      active: true,
    },
    {
      key: "sick",
      name: "Sick Leave",
      quotas: {
        manager: 20,
        full_time: 14,
        part_time: 14,
        intern: 14,
        probationary: 14,
      },
      minAdvanceDays: 0,
      multiDayMinAdvanceDays: 0,
      requiresDocument: true,
      documentLabel: "Medical Certificate URL / Reference",
      guideline:
        "Medical certificate is mandatory. Missing documents may result in Leave Without Pay (LWP).",
      color: "#f59e0b",
      active: true,
    },
    {
      key: "emergency",
      name: "Emergency Leave",
      quotas: {
        manager: 20,
        full_time: 10,
        part_time: 10,
        intern: 10,
        probationary: 10,
      },
      minAdvanceDays: 0,
      multiDayMinAdvanceDays: 0,
      requiresDocument: false,
      documentLabel: "",
      guideline: "Allowed only for genuine emergencies and must be reported immediately.",
      color: "#ef4444",
      active: true,
    },
    {
      key: "examination",
      name: "Examination Leave",
      quotas: {
        manager: 0,
        full_time: 8,
        part_time: 8,
        intern: 8,
        probationary: 8,
      },
      minAdvanceDays: 7,
      multiDayMinAdvanceDays: 7,
      requiresDocument: true,
      documentLabel: "Exam Timetable / Supporting Document Reference",
      guideline:
        "Inform at least 1 week before with your timetable or relevant supporting document attached.",
      color: "#8b5cf6",
      active: true,
    },
  ],
  guidelinesNotes: {
    annualEntitlement:
      "Unused leave will not be carried forward unless approved by management.",
    approvalProcess:
      "1. Inform reporting manager on Slack. 2. Send official email to HR with required CC. 3. Apply through Jibble. Leave is valid only after completing all three steps.",
    attendanceShift:
      "Employees must follow assigned shift timings. Shift change requests should be submitted at least 2 hours before the shift and are subject to business requirements.",
    approvalConditions:
      "Leave may be rejected if work is incomplete, deadlines are missed, handover is pending, or business operations are affected.",
    unauthorizedLwp:
      "Absence without approval or failure to follow the leave process may result in LWP, salary deduction, disciplinary action, performance impact, or termination. Unapproved leave may attract a 1.5x salary deduction per day.",
    halfDay:
      "Half-day leave is allowed only for genuine reasons. Two half-days equal one full-day leave.",
    noticePeriod:
      "No half-day or full-day leave is permitted during the notice period. Unauthorised absence may extend the notice period, change the relieving date, and impact Full & Final (F&F) settlement.",
    holidays:
      "The official holiday calendar will be communicated by management and updated in Jibble.",
    compliance:
      "Employees and interns must comply with this policy. VSI reserves the right to modify the policy as required.",
  },
};

export function normalizeEmploymentTier(raw?: string | null): EmploymentTier {
  const val = (raw || "").toLowerCase().trim();
  if (
    val === "manager" ||
    val === "full_time" ||
    val === "part_time" ||
    val === "intern" ||
    val === "probationary"
  ) {
    return val;
  }
  return "full_time";
}

export function getEmploymentTierLabel(tier?: string | null): string {
  const norm = normalizeEmploymentTier(tier);
  return (
    EMPLOYMENT_TIER_OPTIONS.find((opt) => opt.value === norm)?.label ||
    "Full-Time Employee"
  );
}

export function isHrDepartmentName(team?: string | null): boolean {
  const normalized = (team || "").toLowerCase().trim();
  return (
    normalized === "hr" ||
    normalized === "hr department" ||
    normalized === "human resources" ||
    normalized === "people & hr"
  );
}

export function isHrOrAdminAccess(params: {
  role?: string | null;
  teamName?: string | null;
}): boolean {
  const r = (params.role || "").toLowerCase().trim();
  if (r === "admin" || r === "manager") return true;
  return isHrDepartmentName(params.teamName);
}

export function normalizePolicyConfig(row: any): LeavePolicyData {
  if (!row) return DEFAULT_VSI_LEAVE_POLICY;
  const rawTypes = Array.isArray(row.leaveTypes) ? row.leaveTypes : DEFAULT_VSI_LEAVE_POLICY.leaveTypes;
  const leaveTypes: LeaveTypeRule[] = rawTypes.map((lt: any) => ({
    key: String(lt.key || "custom"),
    name: String(lt.name || "Custom Leave"),
    quotas: {
      manager: Number(lt?.quotas?.manager ?? 0),
      full_time: Number(lt?.quotas?.full_time ?? 0),
      part_time: Number(lt?.quotas?.part_time ?? 0),
      intern: Number(lt?.quotas?.intern ?? 0),
      probationary: Number(lt?.quotas?.probationary ?? 0),
    },
    minAdvanceDays: Number(lt.minAdvanceDays ?? 0),
    multiDayMinAdvanceDays: Number(lt.multiDayMinAdvanceDays ?? lt.minAdvanceDays ?? 0),
    preferredAdvanceDays: lt.preferredAdvanceDays ? Number(lt.preferredAdvanceDays) : undefined,
    requiresDocument: Boolean(lt.requiresDocument),
    documentLabel: String(lt.documentLabel || ""),
    guideline: String(lt.guideline || ""),
    color: String(lt.color || "#3b82f6"),
    active: lt.active !== false,
  }));

  return {
    id: row.id,
    policyTitle: row.policyTitle || DEFAULT_VSI_LEAVE_POLICY.policyTitle,
    effectiveDate: row.effectiveDate || DEFAULT_VSI_LEAVE_POLICY.effectiveDate,
    issuedBy: row.issuedBy || DEFAULT_VSI_LEAVE_POLICY.issuedBy,
    approvedBy: row.approvedBy || DEFAULT_VSI_LEAVE_POLICY.approvedBy,
    standardWorkdayHours: Number(row.standardWorkdayHours ?? 8) || 8,
    carryForwardEnabled: Boolean(row.carryForwardEnabled),
    requireThreeStepProcess:
      row.requireThreeStepProcess !== undefined ? Boolean(row.requireThreeStepProcess) : true,
    blockLeaveOnNoticePeriod:
      row.blockLeaveOnNoticePeriod !== undefined ? Boolean(row.blockLeaveOnNoticePeriod) : true,
    unauthorizedDeductionMultiplier: Number(row.unauthorizedDeductionMultiplier ?? 1.5) || 1.5,
    shiftChangeMinNoticeHours: Number(row.shiftChangeMinNoticeHours ?? 2) || 2,
    leaveTypes,
    guidelinesNotes: {
      ...DEFAULT_VSI_LEAVE_POLICY.guidelinesNotes,
      ...(typeof row.guidelinesNotes === "object" && row.guidelinesNotes ? row.guidelinesNotes : {}),
    },
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function calculateCalendarDaysInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export function computeEmployeeLeaveSummary(
  employee: {
    id: number;
    employmentType?: string | null;
    onNoticePeriod?: boolean;
    leaveQuotaOverrides?: EmployeeLeaveOverrides | null;
  },
  policy: LeavePolicyData,
  requests: LeaveRequestRecord[]
) {
  const tier = normalizeEmploymentTier(employee.employmentType);
  const overrides = employee.leaveQuotaOverrides || {};
  const empRequests = requests.filter((r) => r.userId === employee.id);

  const byType: Record<
    string,
    {
      key: string;
      name: string;
      color: string;
      baseHours: number;
      carryForwardHours: number;
      quotaHours: number;
      usedHours: number;
      pendingHours: number;
      remainingHours: number;
    }
  > = {};

  let totalQuotaHours = 0;
  let totalUsedHours = 0;
  let totalPendingHours = 0;

  for (const lt of policy.leaveTypes) {
    if (!lt.active) continue;
    const defaultTierHours = Number(lt.quotas?.[tier] ?? 0);
    const hasCustomQuota =
      overrides.customQuotas &&
      Object.prototype.hasOwnProperty.call(overrides.customQuotas, lt.key);
    const baseHours = hasCustomQuota
      ? Math.max(0, Number(overrides.customQuotas?.[lt.key] ?? 0))
      : defaultTierHours;
    const carryForwardHours = Math.max(0, Number(overrides.carryForwardHours?.[lt.key] ?? 0));
    const quotaHours = baseHours + carryForwardHours;

    const usedHours = empRequests
      .filter(
        (r) =>
          r.leaveTypeKey === lt.key &&
          r.status === "approved" &&
          !r.isLwp &&
          r.durationMode !== "shift_change"
      )
      .reduce((sum, r) => sum + Number(r.hoursRequested || 0), 0);

    const pendingHours = empRequests
      .filter(
        (r) =>
          r.leaveTypeKey === lt.key &&
          r.status === "pending" &&
          r.durationMode !== "shift_change"
      )
      .reduce((sum, r) => sum + Number(r.hoursRequested || 0), 0);

    const remainingHours = Math.max(0, Number((quotaHours - usedHours).toFixed(2)));

    byType[lt.key] = {
      key: lt.key,
      name: lt.name,
      color: lt.color,
      baseHours,
      carryForwardHours,
      quotaHours,
      usedHours,
      pendingHours,
      remainingHours,
    };

    totalQuotaHours += quotaHours;
    totalUsedHours += usedHours;
    totalPendingHours += pendingHours;
  }

  const lwpHours = empRequests
    .filter((r) => r.status === "lwp" || (r.status === "approved" && r.isLwp))
    .reduce((sum, r) => sum + Number(r.hoursRequested || 0), 0);

  const unauthorizedRequests = empRequests.filter((r) => r.status === "unauthorized");
  const unauthorizedHours = unauthorizedRequests.reduce(
    (sum, r) => sum + Number(r.hoursRequested || 0),
    0
  );
  const salaryDeductionDays = Number(
    (
      unauthorizedRequests.reduce(
        (sum, r) =>
          sum +
          (Number(r.hoursRequested || 0) / Math.max(1, policy.standardWorkdayHours)) *
            Number(r.penaltyMultiplier || policy.unauthorizedDeductionMultiplier || 1.5),
        0
      ) +
      lwpHours / Math.max(1, policy.standardWorkdayHours) +
      Number(overrides.lwpDaysAdjustment ?? 0)
    ).toFixed(2)
  );

  const totalRemainingHours = Math.max(
    0,
    Number((totalQuotaHours - totalUsedHours).toFixed(2))
  );

  return {
    tier,
    byType,
    totalQuotaHours: Number(totalQuotaHours.toFixed(2)),
    totalUsedHours: Number(totalUsedHours.toFixed(2)),
    totalPendingHours: Number(totalPendingHours.toFixed(2)),
    totalRemainingHours,
    lwpHours: Number(lwpHours.toFixed(2)),
    unauthorizedHours: Number(unauthorizedHours.toFixed(2)),
    salaryDeductionDays,
  };
}

export function evaluateLeaveCompliance(params: {
  leaveType: LeaveTypeRule | undefined;
  durationMode: "full_day" | "half_day" | "hours" | "shift_change";
  startDate: string;
  endDate: string;
  hoursRequested: number;
  remainingTypeHours: number;
  documentRef: string;
  slackInformed: boolean;
  hrEmailSent: boolean;
  jibbleApplied: boolean;
  handoverNotes: string;
  onNoticePeriod: boolean;
  policy: LeavePolicyData;
  isHrOrAdminActor?: boolean;
}) {
  const warnings: string[] = [];
  const blockingErrors: string[] = [];

  const {
    leaveType,
    durationMode,
    startDate,
    endDate,
    hoursRequested,
    remainingTypeHours,
    documentRef,
    slackInformed,
    hrEmailSent,
    jibbleApplied,
    handoverNotes,
    onNoticePeriod,
    policy,
    isHrOrAdminActor,
  } = params;

  if (onNoticePeriod && policy.blockLeaveOnNoticePeriod && durationMode !== "shift_change") {
    const msg =
      "Notice Period Policy (Section 10): No half-day or full-day leave is permitted during notice period.";
    warnings.push(msg);
    if (!isHrOrAdminActor) {
      blockingErrors.push(msg);
    }
  }

  if (durationMode !== "shift_change" && leaveType) {
    const daySpan = calculateCalendarDaysInclusive(startDate, endDate);
    const todayIso = new Date().toISOString().split("T")[0];
    const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
    const todayMs = new Date(`${todayIso}T00:00:00Z`).getTime();
    const leadDays = Math.round((startMs - todayMs) / (1000 * 60 * 60 * 24));

    const requiredAdvance =
      daySpan > 1 ? leaveType.multiDayMinAdvanceDays : leaveType.minAdvanceDays;
    if (requiredAdvance > 0 && leadDays < requiredAdvance) {
      warnings.push(
        `Advance Notice Check: ${leaveType.name} for ${daySpan} day(s) requires >= ${requiredAdvance} day(s) notice (currently ${Math.max(0, leadDays)} day(s) ahead).`
      );
    }

    if (leaveType.requiresDocument && !documentRef.trim()) {
      warnings.push(
        `Missing Required Document (${leaveType.documentLabel || "Supporting Doc"}): Absence of documentation may result in Leave Without Pay (LWP).`
      );
    }

    if (hoursRequested > remainingTypeHours) {
      warnings.push(
        `Insufficient ${leaveType.name} Balance: Requesting ${hoursRequested} hrs with ${remainingTypeHours} hrs available (excess may be marked LWP).`
      );
    }
  }

  if (policy.requireThreeStepProcess && durationMode !== "shift_change") {
    const missingSteps: string[] = [];
    if (!slackInformed) missingSteps.push("Inform Manager on Slack");
    if (!hrEmailSent) missingSteps.push("Official Email to HR (with CC)");
    if (!jibbleApplied) missingSteps.push("Apply on Jibble");
    if (missingSteps.length > 0) {
      warnings.push(
        `Incomplete 3-Step Approval Process: Pending ${missingSteps.join(", ")}.`
      );
    }
  }

  if (!handoverNotes.trim() && durationMode !== "shift_change") {
    warnings.push(
      "No handover / pending task notes provided (Section 7: incomplete handover may lead to rejection)."
    );
  }

  if (durationMode === "shift_change") {
    warnings.push(
      `Shift Change Policy (Section 6): Must be submitted >= ${policy.shiftChangeMinNoticeHours} hours before shift start.`
    );
  }

  return {
    warnings,
    blockingErrors,
    suggestedLwp:
      (leaveType?.requiresDocument && !documentRef.trim()) ||
      hoursRequested > remainingTypeHours,
  };
}
