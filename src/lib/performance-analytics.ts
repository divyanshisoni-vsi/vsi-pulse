export type PerformanceDatePreset =
  | "all"
  | "7d"
  | "15d"
  | "30d"
  | "this_month"
  | "custom";

export const PERFORMANCE_PRESET_OPTIONS: Array<{
  value: PerformanceDatePreset;
  label: string;
  shortLabel: string;
}> = [
  { value: "all", label: "All Time (Monthly Target)", shortLabel: "All Time" },
  { value: "7d", label: "Last 7 Days (1 Week)", shortLabel: "7 Days" },
  { value: "15d", label: "Last 15 Days", shortLabel: "15 Days" },
  { value: "30d", label: "Last 30 Days", shortLabel: "30 Days" },
  { value: "this_month", label: "This Month", shortLabel: "This Month" },
  { value: "custom", label: "Custom Date Range", shortLabel: "Custom" },
];

export type ResolvedPerformanceRange = {
  preset: PerformanceDatePreset;
  startDate: string | null;
  endDate: string | null;
  dayCount: number | null;
  label: string;
  shortLabel: string;
};

export type AnalyticsEmployeeInput = {
  id: number;
  name: string;
  email: string;
  team: string;
  role: string;
  target: number;
  done: number;
  status: string;
  employmentType?: string;
};

export type AnalyticsLogInput = {
  id: number;
  date: string;
  employeeId: number;
  activity: string;
  quantity: number;
  status: string;
  source?: string;
  notes?: string;
};

export type AnalyticsAttendanceInput = {
  id: number;
  date: string;
  employeeId: number;
  hours: number;
  status: string;
};

export type EmployeePeriodMetrics = {
  employeeId: number;
  name: string;
  email: string;
  team: string;
  role: string;
  monthlyTarget: number;
  periodTarget: number;
  periodDone: number;
  achievementPct: number;
  uncappedPct: number;
  paceDeltaUnits: number;
  totalLogsCount: number;
  verifiedLogsCount: number;
  pendingLogsCount: number;
  clarificationLogsCount: number;
  verificationRatePct: number;
  clarificationRatePct: number;
  activeLoggedDays: number;
  pacePerActiveDay: number;
  requiredPerDay: number;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  totalDutyHours: number;
  performanceBand: "Exceeding" | "On Track" | "Needs Attention" | "At Risk";
};

export function getTodayIso(timeZone = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().split("T")[0];
}

export function diffDaysInclusive(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1);
}

export function formatShortDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function isValidIsoDate(val?: string | null): val is string {
  return typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

export function resolvePerformanceRange(
  preset: PerformanceDatePreset,
  customStart?: string | null,
  customEnd?: string | null,
  todayIso?: string
): ResolvedPerformanceRange {
  const today = isValidIsoDate(todayIso) ? todayIso : getTodayIso();

  if (preset === "all") {
    return {
      preset: "all",
      startDate: null,
      endDate: null,
      dayCount: null,
      label: "All-Time Cumulative (Full Monthly Targets)",
      shortLabel: "All Time",
    };
  }

  let start = today;
  let end = today;
  let titlePrefix = "Custom";

  if (preset === "7d") {
    start = addDaysIso(today, -6);
    end = today;
    titlePrefix = "Last 7 Days";
  } else if (preset === "15d") {
    start = addDaysIso(today, -14);
    end = today;
    titlePrefix = "Last 15 Days";
  } else if (preset === "30d") {
    start = addDaysIso(today, -29);
    end = today;
    titlePrefix = "Last 30 Days";
  } else if (preset === "this_month") {
    start = `${today.slice(0, 7)}-01`;
    end = today;
    titlePrefix = "This Month";
  } else {
    const validStart = isValidIsoDate(customStart) ? customStart.trim() : addDaysIso(today, -14);
    const validEnd = isValidIsoDate(customEnd) ? customEnd.trim() : today;
    start = validStart <= validEnd ? validStart : validEnd;
    end = validStart <= validEnd ? validEnd : validStart;
    titlePrefix = "Custom Range";
  }

  const dayCount = diffDaysInclusive(start, end);
  const dateSpan = `${formatShortDisplayDate(start)} – ${formatShortDisplayDate(end)}`;
  return {
    preset,
    startDate: start,
    endDate: end,
    dayCount,
    label: `${titlePrefix} (${dateSpan}, ${dayCount}d)`,
    shortLabel: `${titlePrefix} (${dayCount}d)`,
  };
}

export function isDateInRange(
  isoDate: string,
  startDate: string | null,
  endDate: string | null
): boolean {
  if (!startDate && !endDate) return true;
  if (!isoDate) return false;
  if (startDate && isoDate < startDate) return false;
  if (endDate && isoDate > endDate) return false;
  return true;
}

export function computeEmployeePeriodMetrics(
  employee: AnalyticsEmployeeInput,
  logs: AnalyticsLogInput[],
  attendance: AnalyticsAttendanceInput[],
  range: ResolvedPerformanceRange
): EmployeePeriodMetrics {
  const periodLogs = logs.filter(
    (l) =>
      l.employeeId === employee.id &&
      isDateInRange(l.date, range.startDate, range.endDate)
  );
  const periodAttendance = attendance.filter(
    (a) =>
      a.employeeId === employee.id &&
      isDateInRange(a.date, range.startDate, range.endDate)
  );

  const verifiedLogs = periodLogs.filter(
    (l) => l.status.toLowerCase() === "verified"
  );
  const pendingLogs = periodLogs.filter(
    (l) => l.status.toLowerCase() === "pending"
  );
  const clarificationLogs = periodLogs.filter((l) =>
    l.status.toLowerCase().includes("clarification")
  );

  const verifiedFromLogs = verifiedLogs.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0),
    0
  );

  const periodDone =
    range.preset === "all" && verifiedFromLogs === 0 && employee.done > 0
      ? Number(employee.done)
      : verifiedFromLogs;

  const monthlyTarget = Number(employee.target) || 0;
  const periodTarget =
    range.preset === "all" || !range.dayCount
      ? monthlyTarget
      : monthlyTarget > 0
      ? Math.max(1, Math.round((monthlyTarget * range.dayCount) / 30))
      : 0;

  const uncappedPct =
    periodTarget > 0 ? Math.round((periodDone / periodTarget) * 100) : 0;
  const achievementPct = Math.min(100, uncappedPct);
  const paceDeltaUnits = periodDone - periodTarget;

  const totalLogsCount = periodLogs.length;
  const verificationRatePct =
    totalLogsCount > 0
      ? Math.round((verifiedLogs.length / totalLogsCount) * 100)
      : 0;
  const clarificationRatePct =
    totalLogsCount > 0
      ? Math.round((clarificationLogs.length / totalLogsCount) * 100)
      : 0;

  const activeLoggedDays = new Set(periodLogs.map((l) => l.date)).size;
  const pacePerActiveDay =
    activeLoggedDays > 0
      ? Number((periodDone / activeLoggedDays).toFixed(1))
      : 0;
  const baselineDays = range.dayCount || 30;
  const requiredPerDay =
    periodTarget > 0 ? Number((periodTarget / baselineDays).toFixed(1)) : 0;

  const presentDays = periodAttendance.filter(
    (a) => a.status.toLowerCase() === "present"
  ).length;
  const halfDays = periodAttendance.filter((a) =>
    a.status.toLowerCase().includes("half")
  ).length;
  const leaveDays = periodAttendance.filter(
    (a) => a.status.toLowerCase() === "leave"
  ).length;
  const absentDays = periodAttendance.filter(
    (a) => a.status.toLowerCase() === "absent"
  ).length;
  const totalDutyHours = Number(
    periodAttendance
      .reduce((sum, a) => sum + (Number(a.hours) || 0), 0)
      .toFixed(1)
  );

  let performanceBand: EmployeePeriodMetrics["performanceBand"] = "Needs Attention";
  if (achievementPct >= 90 && clarificationRatePct <= 15) {
    performanceBand = "Exceeding";
  } else if (achievementPct >= 65 && clarificationRatePct <= 25) {
    performanceBand = "On Track";
  } else if (achievementPct < 40 || clarificationRatePct >= 40) {
    performanceBand = "At Risk";
  }

  return {
    employeeId: employee.id,
    name: employee.name,
    email: employee.email,
    team: employee.team,
    role: employee.role,
    monthlyTarget,
    periodTarget,
    periodDone,
    achievementPct,
    uncappedPct,
    paceDeltaUnits,
    totalLogsCount,
    verifiedLogsCount: verifiedLogs.length,
    pendingLogsCount: pendingLogs.length,
    clarificationLogsCount: clarificationLogs.length,
    verificationRatePct,
    clarificationRatePct,
    activeLoggedDays,
    pacePerActiveDay,
    requiredPerDay,
    presentDays,
    halfDays,
    leaveDays,
    absentDays,
    totalDutyHours,
    performanceBand,
  };
}

export function computePerformanceTrendSeries(
  employees: AnalyticsEmployeeInput[],
  logs: AnalyticsLogInput[],
  range: ResolvedPerformanceRange
): { labels: string[]; values: number[] } {
  if (employees.length === 0) {
    return {
      labels: ["Period 1", "Period 2", "Period 3", "Period 4"],
      values: [0, 0, 0, 0],
    };
  }

  const effectiveRange =
    range.startDate && range.endDate
      ? range
      : resolvePerformanceRange("30d", null, null);
  const start = effectiveRange.startDate!;
  const end = effectiveRange.endDate!;
  const totalDays = diffDaysInclusive(start, end);
  const bucketCount = totalDays <= 7 ? totalDays : 4;

  const visibleIds = new Set(employees.map((e) => e.id));
  const totalPeriodTarget = employees.reduce((acc, e) => {
    const monthly = Number(e.target) || 0;
    const targetForSpan =
      range.preset === "all"
        ? monthly
        : monthly > 0
        ? Math.max(1, Math.round((monthly * totalDays) / 30))
        : 0;
    return acc + targetForSpan;
  }, 0);

  const labels: string[] = [];
  const values: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketStartIdx = Math.floor((i * totalDays) / bucketCount);
    const bucketEndIdx = Math.floor(((i + 1) * totalDays) / bucketCount) - 1;
    const bucketStart = addDaysIso(start, bucketStartIdx);
    const bucketEnd = addDaysIso(start, Math.max(bucketStartIdx, bucketEndIdx));

    labels.push(
      bucketStart === bucketEnd
        ? formatShortDisplayDate(bucketStart)
        : `${formatShortDisplayDate(bucketStart)}–${formatShortDisplayDate(bucketEnd)}`
    );

    const cumulativeDone = logs
      .filter(
        (l) =>
          visibleIds.has(l.employeeId) &&
          l.status.toLowerCase() === "verified" &&
          isDateInRange(l.date, range.startDate ? start : null, bucketEnd)
      )
      .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

    const pct =
      totalPeriodTarget > 0
        ? Math.min(100, Math.round((cumulativeDone / totalPeriodTarget) * 100))
        : 0;
    values.push(pct);
  }

  return { labels, values };
}
