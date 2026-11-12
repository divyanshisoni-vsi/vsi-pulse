"use client";

import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileCheck2,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  EMPLOYMENT_TIER_OPTIONS,
  EmployeeLeaveOverrides,
  EmploymentTier,
  LeavePolicyData,
  LeaveRequestRecord,
  LeaveTypeRule,
  PublicHolidayRecord,
  calculateCalendarDaysInclusive,
  computeEmployeeLeaveSummary,
  evaluateLeaveCompliance,
  getEmploymentTierLabel,
  isHrDepartmentName,
} from "@/lib/leave-policy";

export type LeaveEmployee = {
  id: number;
  name: string;
  email: string;
  team: string;
  role: string;
  accessRole?: "Admin" | "Employee";
  employmentType?: EmploymentTier;
  onNoticePeriod?: boolean;
  leaveQuotaOverrides?: EmployeeLeaveOverrides | null;
  status: string;
};

export type AttendanceEntry = {
  id: number;
  date: string;
  employeeId: number;
  hours: number;
  status: string;
};

type SubTab = "overview" | "requests" | "policy" | "holidays";

type Props = {
  employees: LeaveEmployee[];
  attendance: AttendanceEntry[];
  leavePolicy: LeavePolicyData;
  leaveRequests: LeaveRequestRecord[];
  publicHolidays: PublicHolidayRecord[];
  sessionEmployeeId: number;
  isAdmin: boolean;
  canManageLeave: boolean;
  isHrDepartment: boolean;
  searchQuery: string;
  initialSubTab?: SubTab;
  onReloadData: () => Promise<void>;
  onOpenAttendanceModal: (recordId?: number) => void;
  onDeleteAttendance: (id: number) => void;
};

export default function LeaveDashboardModule({
  employees,
  attendance,
  leavePolicy,
  leaveRequests,
  publicHolidays,
  sessionEmployeeId,
  isAdmin,
  canManageLeave,
  isHrDepartment,
  searchQuery,
  initialSubTab = "overview",
  onReloadData,
  onOpenAttendanceModal,
  onDeleteAttendance,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);
  const [requestFilter, setRequestFilter] = useState<string>("all");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showPolicyDocModal, setShowPolicyDocModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] =
    useState<LeaveRequestRecord | null>(null);
  const [editingEmployee, setEditingEmployee] =
    useState<LeaveEmployee | null>(null);
  const [holidayDraft, setHolidayDraft] = useState<Partial<PublicHolidayRecord> | null>(
    null
  );

  // Policy Editor Draft (HR & Admin)
  const [policyDraft, setPolicyDraft] = useState<LeavePolicyData>(leavePolicy);
  useEffect(() => {
    setPolicyDraft(leavePolicy);
  }, [leavePolicy]);

  // Charts
  const typeChartRef = useRef<HTMLCanvasElement | null>(null);
  const typeChartInst = useRef<Chart | null>(null);
  const statusChartRef = useRef<HTMLCanvasElement | null>(null);
  const statusChartInst = useRef<Chart | null>(null);

  const visibleEmployees = canManageLeave
    ? employees
    : employees.filter((e) => e.id === sessionEmployeeId);

  const employeeLookup = (id: number) => employees.find((e) => e.id === id);

  const visibleRequests = canManageLeave
    ? leaveRequests
    : leaveRequests.filter((r) => r.userId === sessionEmployeeId);

  const visibleAttendance = canManageLeave
    ? attendance
    : attendance.filter((a) => a.employeeId === sessionEmployeeId);

  const q = searchQuery.toLowerCase().trim();
  const matchesQuery = (parts: Array<string | undefined | null>) => {
    if (!q) return true;
    return parts.some((p) => (p || "").toLowerCase().includes(q));
  };

  // Compute live employee leave summaries from DB
  const summariesByEmployee = visibleEmployees.map((emp) => ({
    employee: emp,
    summary: computeEmployeeLeaveSummary(emp, leavePolicy, leaveRequests),
  }));

  const totalQuotaHours = summariesByEmployee.reduce(
    (s, x) => s + x.summary.totalQuotaHours,
    0
  );
  const totalUsedHours = summariesByEmployee.reduce(
    (s, x) => s + x.summary.totalUsedHours,
    0
  );
  const totalRemainingHours = summariesByEmployee.reduce(
    (s, x) => s + x.summary.totalRemainingHours,
    0
  );
  const totalLwpHours = summariesByEmployee.reduce(
    (s, x) => s + x.summary.lwpHours + x.summary.unauthorizedHours,
    0
  );
  const pendingCount = visibleRequests.filter((r) => r.status === "pending").length;

  const presentAtt = visibleAttendance.filter(
    (a) => a.status.toLowerCase() === "present"
  ).length;
  const halfAtt = visibleAttendance.filter((a) =>
    a.status.toLowerCase().includes("half")
  ).length;
  const attendanceRate =
    visibleAttendance.length > 0
      ? Math.round(((presentAtt + halfAtt * 0.5) / visibleAttendance.length) * 100)
      : 100;

  // Render live Chart.js charts on Overview sub-tab
  useEffect(() => {
    if (subTab !== "overview") return;

    if (typeChartRef.current) {
      if (typeChartInst.current) typeChartInst.current.destroy();
      const ctx = typeChartRef.current.getContext("2d");
      if (ctx) {
        const activeTypes = leavePolicy.leaveTypes.filter((lt) => lt.active);
        const usedByType = activeTypes.map((lt) =>
          summariesByEmployee.reduce(
            (sum, item) => sum + (item.summary.byType[lt.key]?.usedHours || 0),
            0
          )
        );
        const hasAnyUsage = usedByType.some((v) => v > 0);
        const chartLabels = hasAnyUsage
          ? [...activeTypes.map((lt) => lt.name), "LWP / Unauthorised"]
          : activeTypes.map((lt) => `${lt.name} Quota (hrs)`);
        const chartData = hasAnyUsage
          ? [...usedByType, totalLwpHours]
          : activeTypes.map((lt) =>
              summariesByEmployee.reduce(
                (sum, item) => sum + (item.summary.byType[lt.key]?.quotaHours || 0),
                0
              )
            );
        const chartColors = hasAnyUsage
          ? [...activeTypes.map((lt) => lt.color || "#3b82f6"), "#dc2626"]
          : activeTypes.map((lt) => lt.color || "#3b82f6");

        typeChartInst.current = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: chartLabels,
            datasets: [
              {
                data: chartData.every((v) => v === 0) ? [1] : chartData,
                backgroundColor: chartData.every((v) => v === 0)
                  ? ["#e2e8f0"]
                  : chartColors,
                borderColor: "#ffffff",
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "64%",
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  boxWidth: 10,
                  boxHeight: 10,
                  usePointStyle: true,
                  padding: 12,
                  font: { size: 11, weight: "bold" },
                },
              },
            },
          },
        });
      }
    }

    if (statusChartRef.current) {
      if (statusChartInst.current) statusChartInst.current.destroy();
      const ctx = statusChartRef.current.getContext("2d");
      if (ctx) {
        const statusCounts = {
          Approved: visibleRequests.filter((r) => r.status === "approved").length,
          Pending: visibleRequests.filter((r) => r.status === "pending").length,
          LWP: visibleRequests.filter((r) => r.status === "lwp").length,
          "Unauthorised (1.5x)": visibleRequests.filter(
            (r) => r.status === "unauthorized"
          ).length,
          Rejected: visibleRequests.filter((r) => r.status === "rejected").length,
        };

        statusChartInst.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: Object.keys(statusCounts),
            datasets: [
              {
                label: "Requests",
                data: Object.values(statusCounts),
                backgroundColor: [
                  "#10b981",
                  "#f59e0b",
                  "#64748b",
                  "#ef4444",
                  "#94a3b8",
                ],
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1, color: "#64748b", font: { size: 11 } },
                grid: { color: "#f1f5f9" },
              },
              x: {
                grid: { display: false },
                ticks: { color: "#64748b", font: { size: 11 } },
              },
            },
          },
        });
      }
    }

    return () => {
      if (typeChartInst.current) {
        typeChartInst.current.destroy();
        typeChartInst.current = null;
      }
      if (statusChartInst.current) {
        statusChartInst.current.destroy();
        statusChartInst.current = null;
      }
    };
  }, [subTab, leavePolicy, leaveRequests, employees, searchQuery]);

  async function callLeaveApi(payload: Record<string, any>, successMsg?: string) {
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || `Request failed (${res.status}).`,
        });
        return { ok: false, data };
      }
      await onReloadData();
      if (successMsg) {
        setStatusMessage({ type: "success", text: successMsg });
      }
      return { ok: true, data };
    } catch {
      setBusy(false);
      setStatusMessage({
        type: "error",
        text: "Network error while communicating with Leave Management API.",
      });
      return { ok: false, data: null };
    }
  }

  function exportLeaveCsv() {
    const headers = [
      "ID",
      "Employee",
      "Department",
      "Tier",
      "Leave Type",
      "Mode",
      "Start Date",
      "End Date",
      "Hours",
      "Status",
      "LWP",
      "Multiplier",
      "Slack",
      "HR Email",
      "Jibble",
      "Reason",
      "Reviewer Notes",
    ];
    const rows = visibleRequests.map((r) => [
      r.id,
      r.employeeName || "",
      r.employeeTeam || "",
      getEmploymentTierLabel(r.employmentType),
      r.leaveTypeName,
      r.durationMode,
      r.startDate,
      r.endDate,
      r.hoursRequested,
      r.status,
      r.isLwp ? "Yes" : "No",
      r.penaltyMultiplier,
      r.slackInformed ? "Yes" : "No",
      r.hrEmailSent ? "Yes" : "No",
      r.jibbleApplied ? "Yes" : "No",
      r.reason,
      r.reviewerNotes || "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vsi-leave-requests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredRequests = visibleRequests
    .filter((r) => {
      if (requestFilter === "all") return true;
      if (requestFilter === "lwp_unauth")
        return r.status === "lwp" || r.status === "unauthorized" || r.isLwp;
      return r.status === requestFilter;
    })
    .filter((r) =>
      matchesQuery([
        r.employeeName,
        r.employeeTeam,
        r.leaveTypeName,
        r.reason,
        r.status,
      ])
    );

  const filteredAttendance = visibleAttendance.filter((a) =>
    matchesQuery([a.status, a.date, employeeLookup(a.employeeId)?.name])
  );

  const stdHrs = leavePolicy.standardWorkdayHours || 8;
  const toDays = (hrs: number) => Number((hrs / stdHrs).toFixed(1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Top Banner: Role & Active VSI Policy Bar */}
      <div className="leave-policy-banner">
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
              {leavePolicy.policyTitle}
            </span>
            <span className="status-pill verified">
              Effective {leavePolicy.effectiveDate}
            </span>
            {canManageLeave && (
              <span className="status-pill" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <Shield size={11} style={{ marginRight: "4px" }} />
                {isAdmin && isHrDepartment
                  ? "Admin + HR Full Access"
                  : isHrDepartment
                    ? "HR Department Leave Admin"
                    : "Admin Leave Control"}
              </span>
            )}
          </div>
          <div style={{ fontSize: "12px", color: "#475569" }}>
            Issued by <strong>{leavePolicy.issuedBy}</strong> • Approved by{" "}
            <strong>{leavePolicy.approvedBy}</strong> • 1 Day ={" "}
            <strong>{stdHrs} hrs</strong> • Unapproved Penalty:{" "}
            <strong>{leavePolicy.unauthorizedDeductionMultiplier}× salary/day</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setShowPolicyDocModal(true)}
          >
            <FileCheck2 size={14} />
            <span>Official HR Policy</span>
          </button>
          {canManageLeave && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setSubTab("policy")}
            >
              <SlidersHorizontal size={14} />
              <span>Customize Policy</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => setShowApplyModal(true)}
          >
            <Plus size={14} />
            <span>Apply Leave / Shift</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="log-filter-tabs" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className={`log-filter-btn ${subTab === "overview" ? "active" : ""}`}
          onClick={() => setSubTab("overview")}
        >
          <Layers size={13} />
          <span>Overview & Balances</span>
        </button>
        <button
          type="button"
          className={`log-filter-btn ${subTab === "requests" ? "active" : ""}`}
          onClick={() => setSubTab("requests")}
        >
          <Clock size={13} />
          <span>Requests & Approvals</span>
          {pendingCount > 0 && (
            <span className="log-filter-badge" style={{ background: "#f59e0b", color: "#fff" }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`log-filter-btn ${subTab === "policy" ? "active" : ""}`}
          onClick={() => setSubTab("policy")}
        >
          <Settings size={13} />
          <span>
            {canManageLeave ? "Customize Policy & Quotas" : "HR Policy & Entitlements"}
          </span>
        </button>
        <button
          type="button"
          className={`log-filter-btn ${subTab === "holidays" ? "active" : ""}`}
          onClick={() => setSubTab("holidays")}
        >
          <Calendar size={13} />
          <span>Public Holidays & Attendance</span>
          <span className="log-filter-badge">{publicHolidays.length}</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={
            statusMessage.type === "error"
              ? "login-error-msg"
              : "leave-success-banner"
          }
        >
          {statusMessage.type === "error" ? (
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 1: OVERVIEW & BALANCES
         ========================================================= */}
      {subTab === "overview" && (
        <>
          <div className="metrics-grid">
            <div className="metric-card leave-card-blue">
              <div className="metric-top">
                <span className="metric-label">
                  {canManageLeave ? "Workforce Leave Allocation" : "Annual Leave Quota"}
                </span>
                <div className="metric-icon-wrap" style={{ color: "#3b82f6" }}>
                  <CalendarCheck size={16} />
                </div>
              </div>
              <div className="metric-value">{totalQuotaHours} hrs</div>
              <div className="metric-sub">
                <span>
                  ~{toDays(totalQuotaHours)} workdays across {visibleEmployees.length}{" "}
                  {visibleEmployees.length === 1 ? "member" : "members"}
                </span>
              </div>
            </div>

            <div className="metric-card leave-card-amber">
              <div className="metric-top">
                <span className="metric-label">Approved Leave Utilized</span>
                <div className="metric-icon-wrap" style={{ color: "#f59e0b" }}>
                  <Clock size={16} />
                </div>
              </div>
              <div className="metric-value">{totalUsedHours} hrs</div>
              <div className="metric-sub">
                <span>
                  {totalLwpHours > 0
                    ? `${totalLwpHours} hrs LWP / Unapproved`
                    : `${pendingCount} request(s) awaiting approval`}
                </span>
              </div>
            </div>

            <div className="metric-card leave-card-emerald">
              <div className="metric-top">
                <span className="metric-label">Remaining Quota Balance</span>
                <div className="metric-icon-wrap" style={{ color: "#10b981" }}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="metric-value">{totalRemainingHours} hrs</div>
              <div className="metric-sub">
                <span>
                  ~{toDays(totalRemainingHours)} days • Carry-forward:{" "}
                  {leavePolicy.carryForwardEnabled ? "Enabled" : "Mgmt approval only"}
                </span>
              </div>
            </div>

            <div className="metric-card leave-card-purple">
              <div className="metric-top">
                <span className="metric-label">
                  Pending Approvals & Attendance
                </span>
                <div className="metric-icon-wrap" style={{ color: "#8b5cf6" }}>
                  <Users size={16} />
                </div>
              </div>
              <div className="metric-value">
                {pendingCount} Pending • {attendanceRate}%
              </div>
              <div className="metric-sub">
                <span>
                  {visibleAttendance.length > 0
                    ? `${presentAtt} present, ${halfAtt} half-day shifts logged`
                    : "No attendance anomalies logged"}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <div className="card-panel">
              <div className="card-header">
                <div className="card-title">
                  <Layers size={16} />
                  <span>Leave Hours by Category</span>
                </div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Live DB</span>
              </div>
              <div className="card-body">
                <div className="chart-container" style={{ height: "250px" }}>
                  <canvas ref={typeChartRef}></canvas>
                </div>
              </div>
            </div>

            <div className="card-panel">
              <div className="card-header">
                <div className="card-title">
                  <Clock size={16} />
                  <span>Request Status & Compliance Breakdown</span>
                </div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {visibleRequests.length} total
                </span>
              </div>
              <div className="card-body">
                <div className="chart-container" style={{ height: "250px" }}>
                  <canvas ref={statusChartRef}></canvas>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Leave Entitlement & Balance Table */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title">
                <Users size={16} />
                <span>Leave Entitlement & Remaining Hours by Employee</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setShowApplyModal(true)}
                >
                  <Plus size={13} />
                  <span>New Request</span>
                </button>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee & Tier</th>
                      {leavePolicy.leaveTypes
                        .filter((lt) => lt.active)
                        .map((lt) => (
                          <th key={lt.key}>{lt.name.split("/")[0].trim()}</th>
                        ))}
                      <th>LWP / Penalty</th>
                      <th>Remaining Total</th>
                      {canManageLeave && <th>Customize</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {summariesByEmployee
                      .filter(({ employee }) =>
                        matchesQuery([
                          employee.name,
                          employee.email,
                          employee.team,
                          employee.employmentType,
                        ])
                      )
                      .map(({ employee, summary }) => (
                        <tr key={employee.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>
                              {employee.name}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                alignItems: "center",
                                flexWrap: "wrap",
                                marginTop: "3px",
                              }}
                            >
                              <span
                                className="status-pill"
                                style={{
                                  background: "#f1f5f9",
                                  color: "#334155",
                                  fontSize: "10px",
                                }}
                              >
                                {employee.team} •{" "}
                                {getEmploymentTierLabel(employee.employmentType)}
                              </span>
                              {employee.onNoticePeriod && (
                                <span
                                  className="status-pill rejected"
                                  style={{ fontSize: "10px" }}
                                  title="Section 10: No half-day or full-day leave permitted during notice period"
                                >
                                  Notice Period
                                </span>
                              )}
                            </div>
                          </td>
                          {leavePolicy.leaveTypes
                            .filter((lt) => lt.active)
                            .map((lt) => {
                              const cell = summary.byType[lt.key];
                              return (
                                <td key={lt.key} style={{ whiteSpace: "nowrap" }}>
                                  {cell && cell.quotaHours > 0 ? (
                                    <div>
                                      <span style={{ fontWeight: 600 }}>
                                        {cell.remainingHours}
                                      </span>
                                      <span style={{ color: "#64748b", fontSize: "11px" }}>
                                        /{cell.quotaHours}h
                                      </span>
                                      {cell.carryForwardHours > 0 && (
                                        <span
                                          style={{
                                            display: "block",
                                            fontSize: "10px",
                                            color: "#0ea5e9",
                                          }}
                                        >
                                          +{cell.carryForwardHours}h CF
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>-</span>
                                  )}
                                </td>
                              );
                            })}
                          <td>
                            {summary.salaryDeductionDays > 0 ? (
                              <span className="status-pill rejected">
                                {summary.salaryDeductionDays}d Deduction
                              </span>
                            ) : (
                              <span style={{ color: "#64748b", fontSize: "12px" }}>
                                0 days
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                summary.totalRemainingHours > 16
                                  ? "verified"
                                  : summary.totalRemainingHours > 0
                                    ? "pending"
                                    : "rejected"
                              }`}
                            >
                              {summary.totalRemainingHours} / {summary.totalQuotaHours} hrs
                            </span>
                          </td>
                          {canManageLeave && (
                            <td>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => setEditingEmployee(employee)}
                                title="Customize employee tier, notice period status, and leave hours"
                              >
                                <UserCog size={13} />
                                <span>Customize</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================
          SUB-TAB 2: LEAVE REQUESTS & APPROVAL QUEUE
         ========================================================= */}
      {subTab === "requests" && (
        <div className="card-panel">
          <div className="card-header">
            <div className="card-title">
              <Clock size={16} />
              <span>Leave & Shift Change Requests</span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={exportLeaveCsv}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => setShowApplyModal(true)}
              >
                <Plus size={13} />
                <span>New Request</span>
              </button>
            </div>
          </div>

          <div className="card-body">
            <div className="log-filter-tabs">
              {[
                { key: "all", label: "All" },
                { key: "pending", label: "Pending" },
                { key: "approved", label: "Approved" },
                { key: "lwp_unauth", label: "LWP / Unauthorised" },
                { key: "rejected", label: "Rejected" },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  className={`log-filter-btn ${requestFilter === pill.key ? "active" : ""}`}
                  onClick={() => setRequestFilter(pill.key)}
                >
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            {filteredRequests.length === 0 ? (
              <div className="empty-box">
                <CalendarCheck size={28} style={{ color: "#94a3b8" }} />
                <div className="empty-title">No leave requests match this view</div>
                <div className="empty-desc">
                  Submit a leave or shift change request using the VSI 3-step approval
                  checklist.
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowApplyModal(true)}
                >
                  <Plus size={14} />
                  <span>Apply for Leave</span>
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      {canManageLeave && <th>Employee</th>}
                      <th>Type & Dates</th>
                      <th>Reason & Handover</th>
                      <th>3-Step & Compliance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((r) => (
                      <tr key={r.id}>
                        {canManageLeave && (
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.employeeName}</div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {r.employeeTeam} •{" "}
                              {getEmploymentTierLabel(r.employmentType)}
                            </div>
                          </td>
                        )}
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{r.leaveTypeName}</div>
                          <div style={{ fontSize: "12px", color: "#475569" }}>
                            {r.startDate === r.endDate
                              ? r.startDate
                              : `${r.startDate} → ${r.endDate}`}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {r.hoursRequested} hrs (
                            {r.durationMode === "half_day"
                              ? "Half-Day = 0.5 day"
                              : r.durationMode === "shift_change"
                                ? "Shift Change"
                                : r.durationMode === "hours"
                                  ? "Custom Hours"
                                  : "Full Day"}
                            )
                          </div>
                        </td>
                        <td style={{ maxWidth: "260px" }}>
                          <div style={{ fontSize: "12px", color: "#0f172a" }}>
                            {r.reason}
                          </div>
                          {r.handoverNotes && (
                            <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px" }}>
                              <strong>Handover:</strong> {r.handoverNotes}
                            </div>
                          )}
                          {r.documentRef && (
                            <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "2px" }}>
                              <strong>Doc:</strong> {r.documentRef}
                            </div>
                          )}
                          {r.reviewerNotes && (
                            <div style={{ fontSize: "11px", color: "#b45309", marginTop: "3px" }}>
                              <strong>HR/Mgr Note:</strong> {r.reviewerNotes}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <span
                              className={`step-badge ${r.slackInformed ? "done" : "missing"}`}
                            >
                              Slack {r.slackInformed ? "✓" : "✗"}
                            </span>
                            <span
                              className={`step-badge ${r.hrEmailSent ? "done" : "missing"}`}
                            >
                              HR Email {r.hrEmailSent ? "✓" : "✗"}
                            </span>
                            <span
                              className={`step-badge ${r.jibbleApplied ? "done" : "missing"}`}
                            >
                              Jibble {r.jibbleApplied ? "✓" : "✗"}
                            </span>
                          </div>
                          {r.policyWarnings.length > 0 && (
                            <div style={{ fontSize: "11px", color: "#b45309" }}>
                              {r.policyWarnings[0]}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              r.status === "approved"
                                ? r.isLwp
                                  ? "needs-clarification"
                                  : "verified"
                                : r.status === "pending"
                                  ? "pending"
                                  : r.status === "lwp"
                                    ? "needs-clarification"
                                    : "rejected"
                            }`}
                          >
                            {r.status === "unauthorized"
                              ? `Unauthorised (${r.penaltyMultiplier}× LWP)`
                              : r.status === "approved" && r.isLwp
                                ? "Approved (LWP)"
                                : r.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {canManageLeave && (
                              <>
                                <button
                                  type="button"
                                  className="btn-primary btn-sm"
                                  onClick={() => setReviewingRequest(r)}
                                >
                                  Review
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  onClick={() => {
                                    if (confirm("Delete this leave record?")) {
                                      callLeaveApi(
                                        { action: "deleteLeaveRequest", id: r.id },
                                        "Leave request removed."
                                      );
                                    }
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                            {!canManageLeave && r.status === "pending" && (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() =>
                                  callLeaveApi(
                                    {
                                      action: "updateLeaveStatus",
                                      id: r.id,
                                      status: "cancelled",
                                    },
                                    "Leave request cancelled."
                                  )
                                }
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 3: CUSTOMIZE POLICY & QUOTA MATRIX (HR & ADMIN)
         ========================================================= */}
      {subTab === "policy" && (
        <div className="card-panel">
          <div className="card-header">
            <div className="card-title">
              <SlidersHorizontal size={16} />
              <span>
                {canManageLeave
                  ? "HR & Admin Policy Customizer (VSI Entitlements & Compliance)"
                  : "VSI HR Leave Policy & Entitlement Matrix"}
              </span>
            </div>
            {canManageLeave && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Restore all quotas and rules back to Official VSI HR Policy (13 July 2026)?"
                      )
                    ) {
                      callLeaveApi(
                        { action: "resetLeavePolicy" },
                        "Restored official VSI July 2026 HR policy."
                      );
                    }
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Restore VSI Baseline</span>
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy}
                  onClick={() =>
                    callLeaveApi(
                      { action: "updateLeavePolicy", policy: policyDraft },
                      "HR Leave Policy & custom quotas saved successfully."
                    )
                  }
                >
                  <Save size={13} />
                  <span>{busy ? "Saving…" : "Save Policy Changes"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Policy Global Controls */}
            <div className="modal-form-grid">
              <div>
                <label>Policy Title</label>
                <input
                  value={policyDraft.policyTitle}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, policyTitle: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Effective Date</label>
                <input
                  type="date"
                  value={policyDraft.effectiveDate}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, effectiveDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Issued By</label>
                <input
                  value={policyDraft.issuedBy}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, issuedBy: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Approved By (Signatory)</label>
                <input
                  value={policyDraft.approvedBy}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, approvedBy: e.target.value })
                  }
                />
              </div>
              <div>
                <label>1 Full Workday (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step="0.5"
                  value={policyDraft.standardWorkdayHours}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      standardWorkdayHours: Number(e.target.value) || 8,
                    })
                  }
                />
              </div>
              <div>
                <label>Unapproved Leave Deduction Multiplier (×)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step="0.5"
                  value={policyDraft.unauthorizedDeductionMultiplier}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      unauthorizedDeductionMultiplier: Number(e.target.value) || 1.5,
                    })
                  }
                />
              </div>
              <div>
                <label>Shift Change Min Notice (Hours)</label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={policyDraft.shiftChangeMinNoticeHours}
                  disabled={!canManageLeave}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      shiftChangeMinNoticeHours: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: canManageLeave ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={policyDraft.carryForwardEnabled}
                    disabled={!canManageLeave}
                    onChange={(e) =>
                      setPolicyDraft({
                        ...policyDraft,
                        carryForwardEnabled: e.target.checked,
                      })
                    }
                    style={{ width: "auto" }}
                  />
                  <span>Allow automatic annual carry-forward (Sec 3)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: canManageLeave ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={policyDraft.requireThreeStepProcess}
                    disabled={!canManageLeave}
                    onChange={(e) =>
                      setPolicyDraft({
                        ...policyDraft,
                        requireThreeStepProcess: e.target.checked,
                      })
                    }
                    style={{ width: "auto" }}
                  />
                  <span>Enforce 3-Step Approval: Slack + HR Email + Jibble (Sec 5)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: canManageLeave ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={policyDraft.blockLeaveOnNoticePeriod}
                    disabled={!canManageLeave}
                    onChange={(e) =>
                      setPolicyDraft({
                        ...policyDraft,
                        blockLeaveOnNoticePeriod: e.target.checked,
                      })
                    }
                    style={{ width: "auto" }}
                  />
                  <span>Block full/half-day leave during Notice Period (Sec 10)</span>
                </label>
              </div>
            </div>

            {/* Editable Quota Matrix Table */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  Annual Leave Entitlement Matrix (Hours per Category)
                </h3>
                {canManageLeave && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      setPolicyDraft({
                        ...policyDraft,
                        leaveTypes: [
                          ...policyDraft.leaveTypes,
                          {
                            key: `custom_${Date.now()}`,
                            name: "New Custom Leave",
                            quotas: {
                              manager: 8,
                              full_time: 8,
                              part_time: 0,
                              intern: 0,
                              probationary: 0,
                            },
                            minAdvanceDays: 2,
                            multiDayMinAdvanceDays: 5,
                            requiresDocument: false,
                            documentLabel: "",
                            guideline: "Custom HR policy leave category.",
                            color: "#0d9488",
                            active: true,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={13} />
                    <span>Add Leave Type</span>
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Manager (hrs)</th>
                      <th>Full-Time (hrs)</th>
                      <th>Part-Time (hrs)</th>
                      <th>Intern (hrs)</th>
                      <th>Probation (hrs)</th>
                      <th>Notice (1d / 2+d)</th>
                      <th>Doc Mandatory</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policyDraft.leaveTypes.map((lt, idx) => {
                      const updateType = (patch: Partial<LeaveTypeRule>) => {
                        const copy = [...policyDraft.leaveTypes];
                        copy[idx] = { ...copy[idx], ...patch };
                        setPolicyDraft({ ...policyDraft, leaveTypes: copy });
                      };
                      const updateTierHours = (tier: EmploymentTier, val: number) => {
                        updateType({
                          quotas: { ...lt.quotas, [tier]: Math.max(0, val) },
                        });
                      };
                      return (
                        <tr key={lt.key}>
                          <td>
                            <input
                              value={lt.name}
                              disabled={!canManageLeave}
                              onChange={(e) => updateType({ name: e.target.value })}
                              style={{ minWidth: "150px", padding: "6px 8px" }}
                            />
                          </td>
                          {(
                            [
                              "manager",
                              "full_time",
                              "part_time",
                              "intern",
                              "probationary",
                            ] as EmploymentTier[]
                          ).map((tier) => (
                            <td key={tier}>
                              <input
                                type="number"
                                min={0}
                                value={lt.quotas[tier]}
                                disabled={!canManageLeave}
                                onChange={(e) =>
                                  updateTierHours(tier, Number(e.target.value) || 0)
                                }
                                style={{ width: "68px", padding: "6px 8px" }}
                              />
                            </td>
                          ))}
                          <td>
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              <input
                                type="number"
                                min={0}
                                value={lt.minAdvanceDays}
                                disabled={!canManageLeave}
                                onChange={(e) =>
                                  updateType({
                                    minAdvanceDays: Number(e.target.value) || 0,
                                  })
                                }
                                style={{ width: "54px", padding: "6px 6px" }}
                                title="Single-day notice days"
                              />
                              <span>/</span>
                              <input
                                type="number"
                                min={0}
                                value={lt.multiDayMinAdvanceDays}
                                disabled={!canManageLeave}
                                onChange={(e) =>
                                  updateType({
                                    multiDayMinAdvanceDays: Number(e.target.value) || 0,
                                  })
                                }
                                style={{ width: "54px", padding: "6px 6px" }}
                                title="Multi-day notice days"
                              />
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={lt.requiresDocument}
                              disabled={!canManageLeave}
                              onChange={(e) =>
                                updateType({ requiresDocument: e.target.checked })
                              }
                            />
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <input
                                type="checkbox"
                                checked={lt.active}
                                disabled={!canManageLeave}
                                onChange={(e) => updateType({ active: e.target.checked })}
                              />
                              {canManageLeave && policyDraft.leaveTypes.length > 1 && (
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  title="Remove leave type"
                                  onClick={() =>
                                    setPolicyDraft({
                                      ...policyDraft,
                                      leaveTypes: policyDraft.leaveTypes.filter(
                                        (_, i) => i !== idx
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editable Guidelines Clauses */}
            <div className="modal-form-grid">
              {(
                [
                  ["annualEntitlement", "Sec 3: Annual Entitlement & Carry-Forward"],
                  ["approvalProcess", "Sec 5: Mandatory 3-Step Approval Process"],
                  ["attendanceShift", "Sec 6: Attendance & Shift Policy"],
                  ["approvalConditions", "Sec 7: Leave Approval Conditions"],
                  ["unauthorizedLwp", "Sec 8: Unauthorised Absence & LWP (1.5×)"],
                  ["halfDay", "Sec 9: Half-Day Leave Rule"],
                  ["noticePeriod", "Sec 10: Notice Period Leave Lock"],
                  ["compliance", "Sec 12: Policy Compliance"],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label>{label}</label>
                  <textarea
                    rows={2}
                    disabled={!canManageLeave}
                    value={policyDraft.guidelinesNotes[field]}
                    onChange={(e) =>
                      setPolicyDraft({
                        ...policyDraft,
                        guidelinesNotes: {
                          ...policyDraft.guidelinesNotes,
                          [field]: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 4: PUBLIC HOLIDAYS & ATTENDANCE LOGS
         ========================================================= */}
      {subTab === "holidays" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title">
                <Calendar size={16} />
                <span>Official Public Holidays Calendar (Section 11 — Synced with Jibble)</span>
              </div>
              {canManageLeave && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() =>
                    setHolidayDraft({
                      date: new Date().toISOString().split("T")[0],
                      name: "",
                      type: "Official Holiday",
                      syncedJibble: true,
                      notes: "",
                    })
                  }
                >
                  <Plus size={13} />
                  <span>Add Holiday</span>
                </button>
              )}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {publicHolidays.length === 0 ? (
                <div className="empty-box">
                  <Calendar size={28} style={{ color: "#94a3b8" }} />
                  <div className="empty-title">No public holidays configured yet</div>
                  <div className="empty-desc">
                    {leavePolicy.guidelinesNotes.holidays}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Holiday Name</th>
                        <th>Type</th>
                        <th>Jibble Sync</th>
                        <th>Notes</th>
                        {canManageLeave && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {publicHolidays.map((h) => (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 600 }}>{h.date}</td>
                          <td>{h.name}</td>
                          <td>{h.type}</td>
                          <td>
                            <span
                              className={`status-pill ${
                                h.syncedJibble ? "verified" : "pending"
                              }`}
                            >
                              {h.syncedJibble ? "Updated in Jibble" : "Pending Jibble"}
                            </span>
                          </td>
                          <td>{h.notes || "-"}</td>
                          {canManageLeave && (
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => setHolidayDraft(h)}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  onClick={() =>
                                    callLeaveApi(
                                      { action: "deleteHoliday", id: h.id },
                                      "Holiday deleted."
                                    )
                                  }
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Daily Attendance Logs */}
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title">
                <CalendarCheck size={16} />
                <span>Daily Attendance & Shift Presence Log</span>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onOpenAttendanceModal()}
              >
                <Plus size={13} />
                <span>Log Attendance</span>
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {filteredAttendance.length === 0 ? (
                <div className="empty-box">
                  <div className="empty-title">No daily attendance entries yet</div>
                  <div className="empty-desc">
                    Approved full-day/half-day leave requests automatically sync here,
                    or click Log Attendance to add shifts manually.
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        {canManageLeave && <th>Member</th>}
                        <th>Duty Hours</th>
                        <th>Status</th>
                        {canManageLeave && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((a) => (
                        <tr key={a.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{a.date}</td>
                          {canManageLeave && (
                            <td style={{ fontWeight: 600 }}>
                              {employeeLookup(a.employeeId)?.name || `ID #${a.employeeId}`}
                            </td>
                          )}
                          <td>{a.hours} hrs</td>
                          <td>
                            <span
                              className={`status-pill ${
                                a.status === "Present"
                                  ? "present"
                                  : a.status.toLowerCase().includes("half")
                                    ? "half-day"
                                    : a.status === "Leave"
                                      ? "leave"
                                      : "absent"
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                          {canManageLeave && (
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => onOpenAttendanceModal(a.id)}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  onClick={() => onDeleteAttendance(a.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODALS
         ========================================================= */}
      {showApplyModal && (
        <ApplyLeaveModal
          employees={visibleEmployees}
          policy={leavePolicy}
          leaveRequests={leaveRequests}
          defaultEmployeeId={sessionEmployeeId}
          canManageLeave={canManageLeave}
          busy={busy}
          onClose={() => setShowApplyModal(false)}
          onSubmit={async (payload) => {
            const res = await callLeaveApi(
              payload,
              "Request submitted and recorded in Leave Dashboard."
            );
            if (res.ok) setShowApplyModal(false);
          }}
        />
      )}

      {reviewingRequest && (
        <ReviewLeaveModal
          request={reviewingRequest}
          policy={leavePolicy}
          busy={busy}
          onClose={() => setReviewingRequest(null)}
          onSubmit={async (payload) => {
            const res = await callLeaveApi(
              payload,
              "Leave request status updated."
            );
            if (res.ok) setReviewingRequest(null);
          }}
        />
      )}

      {editingEmployee && (
        <CustomizeEmployeeQuotaModal
          employee={editingEmployee}
          policy={leavePolicy}
          busy={busy}
          onClose={() => setEditingEmployee(null)}
          onSubmit={async (payload) => {
            const res = await callLeaveApi(
              payload,
              `Updated custom leave settings for ${editingEmployee.name}.`
            );
            if (res.ok) setEditingEmployee(null);
          }}
        />
      )}

      {holidayDraft && (
        <HolidayEditorModal
          draft={holidayDraft}
          busy={busy}
          onClose={() => setHolidayDraft(null)}
          onSubmit={async (payload) => {
            const res = await callLeaveApi(payload, "Public holiday saved.");
            if (res.ok) setHolidayDraft(null);
          }}
        />
      )}

      {showPolicyDocModal && (
        <OfficialPolicyReferenceModal
          policy={leavePolicy}
          onClose={() => setShowPolicyDocModal(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   SUB-MODAL 1: APPLY LEAVE / SHIFT CHANGE REQUEST
--------------------------------------------------------- */
function ApplyLeaveModal({
  employees,
  policy,
  leaveRequests,
  defaultEmployeeId,
  canManageLeave,
  busy,
  onClose,
  onSubmit,
}: {
  employees: LeaveEmployee[];
  policy: LeavePolicyData;
  leaveRequests: LeaveRequestRecord[];
  defaultEmployeeId: number;
  canManageLeave: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => void;
}) {
  const activeTypes = policy.leaveTypes.filter((lt) => lt.active);
  const todayIso = new Date().toISOString().split("T")[0];

  const [userId, setUserId] = useState<number>(
    employees.find((e) => e.id === defaultEmployeeId)?.id || employees[0]?.id || 1
  );
  const [durationMode, setDurationMode] = useState<
    "full_day" | "half_day" | "hours" | "shift_change"
  >("full_day");
  const [leaveTypeKey, setLeaveTypeKey] = useState<string>(
    activeTypes[0]?.key || "casual"
  );
  const [startDate, setStartDate] = useState<string>(todayIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [customHours, setCustomHours] = useState<number>(
    policy.standardWorkdayHours || 8
  );
  const [reason, setReason] = useState<string>("");
  const [handoverNotes, setHandoverNotes] = useState<string>("");
  const [documentRef, setDocumentRef] = useState<string>("");
  const [slackInformed, setSlackInformed] = useState<boolean>(false);
  const [hrEmailSent, setHrEmailSent] = useState<boolean>(false);
  const [jibbleApplied, setJibbleApplied] = useState<boolean>(false);
  const [autoApprove, setAutoApprove] = useState<boolean>(false);

  const selectedEmp = employees.find((e) => e.id === Number(userId)) || employees[0];
  const selectedType = activeTypes.find((lt) => lt.key === leaveTypeKey);
  const empSummary = selectedEmp
    ? computeEmployeeLeaveSummary(selectedEmp, policy, leaveRequests)
    : null;
  const remainingForType = empSummary?.byType[leaveTypeKey]?.remainingHours ?? 0;

  const effEndDate =
    durationMode === "half_day" || durationMode === "shift_change"
      ? startDate
      : endDate < startDate
        ? startDate
        : endDate;
  const dayCount = calculateCalendarDaysInclusive(startDate, effEndDate);
  const computedHours =
    durationMode === "full_day"
      ? Number((dayCount * (policy.standardWorkdayHours || 8)).toFixed(2))
      : durationMode === "half_day"
        ? Number(((policy.standardWorkdayHours || 8) / 2).toFixed(2))
        : customHours;

  const liveCompliance = evaluateLeaveCompliance({
    leaveType: selectedType,
    durationMode,
    startDate,
    endDate: effEndDate,
    hoursRequested: computedHours,
    remainingTypeHours: remainingForType,
    documentRef,
    slackInformed,
    hrEmailSent,
    jibbleApplied,
    handoverNotes,
    onNoticePeriod: Boolean(selectedEmp?.onNoticePeriod),
    policy,
    isHrOrAdminActor: canManageLeave,
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: "620px" }}>
        <div className="modal-head">
          <h2>Apply Leave or Shift Change (VSI HR Policy)</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              action: "applyLeave",
              userId,
              durationMode,
              leaveTypeKey,
              startDate,
              endDate: effEndDate,
              hoursRequested: computedHours,
              reason,
              handoverNotes,
              documentRef,
              slackInformed,
              hrEmailSent,
              jibbleApplied,
              autoApprove: canManageLeave ? autoApprove : false,
            });
          }}
        >
          <div className="modal-content">
            <div className="modal-form-grid">
              {canManageLeave && (
                <div className="full-span">
                  <label>Employee</label>
                  <select
                    value={userId}
                    onChange={(e) => setUserId(Number(e.target.value))}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.team} •{" "}
                        {getEmploymentTierLabel(emp.employmentType)}
                        {emp.onNoticePeriod ? " • NOTICE PERIOD" : ""})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label>Request Type / Duration Mode</label>
                <select
                  value={durationMode}
                  onChange={(e) => setDurationMode(e.target.value as any)}
                >
                  <option value="full_day">
                    Full Day(s) ({policy.standardWorkdayHours} hrs/day)
                  </option>
                  <option value="half_day">
                    Half-Day Leave ({policy.standardWorkdayHours / 2} hrs = 0.5 day)
                  </option>
                  <option value="hours">Partial Hours</option>
                  <option value="shift_change">
                    Shift Change (&gt;= {policy.shiftChangeMinNoticeHours} hrs notice)
                  </option>
                </select>
              </div>

              {durationMode !== "shift_change" && (
                <div>
                  <label>Leave Category</label>
                  <select
                    value={leaveTypeKey}
                    onChange={(e) => setLeaveTypeKey(e.target.value)}
                  >
                    {activeTypes.map((lt) => {
                      const avail = empSummary?.byType[lt.key]?.remainingHours ?? 0;
                      const quota = empSummary?.byType[lt.key]?.quotaHours ?? 0;
                      return (
                        <option key={lt.key} value={lt.key}>
                          {lt.name} ({avail}/{quota} hrs left)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  required
                />
              </div>

              {durationMode === "full_day" ? (
                <div>
                  <label>End Date ({dayCount} day = {computedHours} hrs)</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              ) : durationMode === "hours" ? (
                <div>
                  <label>Requested Hours</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={customHours}
                    onChange={(e) => setCustomHours(Number(e.target.value) || 1)}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label>Computed Duration</label>
                  <input value={`${computedHours} hrs (${durationMode === "half_day" ? "0.5 Day" : "Shift"})`} disabled />
                </div>
              )}

              {selectedType && durationMode !== "shift_change" && (
                <div
                  className="full-span"
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    color: "#1e40af",
                  }}
                >
                  <strong>{selectedType.name} Policy:</strong> {selectedType.guideline}{" "}
                  (Available balance: <strong>{remainingForType} hrs</strong>)
                </div>
              )}

              <div className="full-span">
                <label>Reason</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide genuine reason / shift change timing details..."
                  required
                />
              </div>

              {durationMode !== "shift_change" && (
                <>
                  <div>
                    <label>Work Handover & Pending Tasks (Section 7)</label>
                    <input
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Who is covering deadlines / handover status?"
                    />
                  </div>
                  <div>
                    <label>
                      {selectedType?.documentLabel || "Supporting Document URL / Reference"}{" "}
                      {selectedType?.requiresDocument && "(Mandatory)"}
                    </label>
                    <input
                      value={documentRef}
                      onChange={(e) => setDocumentRef(e.target.value)}
                      placeholder={
                        selectedType?.requiresDocument
                          ? "Medical cert / Timetable link or ref..."
                          : "Optional link or reference..."
                      }
                    />
                  </div>

                  <div className="full-span" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "8px", color: "#0f172a" }}>
                      Mandatory 3-Step Approval Process (Section 5)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={slackInformed} onChange={(e) => setSlackInformed(e.target.checked)} style={{ width: "auto" }} />
                        <span>1. Informed my reporting manager on Slack</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={hrEmailSent} onChange={(e) => setHrEmailSent(e.target.checked)} style={{ width: "auto" }} />
                        <span>2. Sent official email to HR with required CC</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={jibbleApplied} onChange={(e) => setJibbleApplied(e.target.checked)} style={{ width: "auto" }} />
                        <span>3. Applied through Jibble</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {canManageLeave && (
                <div className="full-span">
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>HR/Admin Override: Approve immediately and sync Attendance Log</span>
                  </label>
                </div>
              )}

              {liveCompliance.blockingErrors.length > 0 && (
                <div className="full-span login-error-msg">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{liveCompliance.blockingErrors[0]}</span>
                </div>
              )}

              {liveCompliance.blockingErrors.length === 0 &&
                liveCompliance.warnings.length > 0 && (
                  <div
                    className="full-span ai-tip-box"
                    style={{ flexDirection: "column", alignItems: "flex-start" }}
                  >
                    <strong>VSI Policy Compliance Checks:</strong>
                    {liveCompliance.warnings.map((w, idx) => (
                      <span key={idx}>• {w}</span>
                    ))}
                  </div>
                )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || liveCompliance.blockingErrors.length > 0}
            >
              {busy ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SUB-MODAL 2: REVIEW REQUEST (HR & ADMIN)
--------------------------------------------------------- */
function ReviewLeaveModal({
  request,
  policy,
  busy,
  onClose,
  onSubmit,
}: {
  request: LeaveRequestRecord;
  policy: LeavePolicyData;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => void;
}) {
  const [status, setStatus] = useState<string>(
    request.status === "pending" ? "approved" : request.status
  );
  const [penaltyMultiplier, setPenaltyMultiplier] = useState<number>(
    request.penaltyMultiplier || policy.unauthorizedDeductionMultiplier || 1.5
  );
  const [reviewerNotes, setReviewerNotes] = useState<string>(
    request.reviewerNotes || ""
  );

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: "520px" }}>
        <div className="modal-head">
          <h2>Review Request: {request.employeeName}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              action: "updateLeaveStatus",
              id: request.id,
              status,
              penaltyMultiplier,
              reviewerNotes,
            });
          }}
        >
          <div className="modal-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", fontSize: "12px" }}>
              <div>
                <strong>{request.leaveTypeName}</strong> • {request.startDate} to{" "}
                {request.endDate} ({request.hoursRequested} hrs)
              </div>
              <div style={{ marginTop: "4px", color: "#475569" }}>
                <strong>Reason:</strong> {request.reason}
              </div>
              {request.documentRef && (
                <div style={{ marginTop: "4px", color: "#2563eb" }}>
                  <strong>Doc:</strong> {request.documentRef}
                </div>
              )}
              {request.policyWarnings.length > 0 && (
                <div style={{ marginTop: "6px", color: "#b45309" }}>
                  <strong>Flags:</strong> {request.policyWarnings.join(" | ")}
                </div>
              )}
            </div>

            <div>
              <label>HR / Admin Decision</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="approved">Approve (Deduct from Leave Balance)</option>
                <option value="lwp">Mark Leave Without Pay (LWP / Missing Docs)</option>
                <option value="unauthorized">
                  Flag Unauthorised Absence ({policy.unauthorizedDeductionMultiplier}× Salary Deduction)
                </option>
                <option value="rejected">Reject (Incomplete Handover / Deadlines)</option>
                <option value="pending">Return to Pending</option>
              </select>
            </div>

            {status === "unauthorized" && (
              <div>
                <label>Unapproved Salary Deduction Multiplier (Section 8)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step="0.5"
                  value={penaltyMultiplier}
                  onChange={(e) =>
                    setPenaltyMultiplier(Number(e.target.value) || 1.5)
                  }
                />
              </div>
            )}

            <div>
              <label>Reviewer Notes / Conditions (Section 7 & 8)</label>
              <textarea
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Reason for approval, LWP, rejection, or handover note..."
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save Decision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SUB-MODAL 3: CUSTOMIZE EMPLOYEE QUOTAS & TIER (HR & ADMIN)
--------------------------------------------------------- */
function CustomizeEmployeeQuotaModal({
  employee,
  policy,
  busy,
  onClose,
  onSubmit,
}: {
  employee: LeaveEmployee;
  policy: LeavePolicyData;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => void;
}) {
  const [employmentType, setEmploymentType] = useState<EmploymentTier>(
    employee.employmentType || "full_time"
  );
  const [onNoticePeriod, setOnNoticePeriod] = useState<boolean>(
    Boolean(employee.onNoticePeriod)
  );
  const [customQuotas, setCustomQuotas] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const existing = employee.leaveQuotaOverrides?.customQuotas || {};
    for (const lt of policy.leaveTypes) {
      if (existing[lt.key] !== undefined) init[lt.key] = String(existing[lt.key]);
    }
    return init;
  });
  const [carryForwardHours, setCarryForwardHours] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const existing = employee.leaveQuotaOverrides?.carryForwardHours || {};
    for (const lt of policy.leaveTypes) {
      if (existing[lt.key] !== undefined) init[lt.key] = String(existing[lt.key]);
    }
    return init;
  });
  const [lwpDaysAdjustment, setLwpDaysAdjustment] = useState<number>(
    Number(employee.leaveQuotaOverrides?.lwpDaysAdjustment ?? 0)
  );
  const [note, setNote] = useState<string>(employee.leaveQuotaOverrides?.note || "");

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: "600px" }}>
        <div className="modal-head">
          <h2>Customize Employee Leave: {employee.name}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsedCustom: Record<string, number> = {};
            const parsedCf: Record<string, number> = {};
            for (const [k, v] of Object.entries(customQuotas)) {
              if (v !== "" && !Number.isNaN(Number(v))) parsedCustom[k] = Number(v);
            }
            for (const [k, v] of Object.entries(carryForwardHours)) {
              if (v !== "" && !Number.isNaN(Number(v))) parsedCf[k] = Number(v);
            }
            onSubmit({
              action: "updateEmployeeLeaveSettings",
              userId: employee.id,
              employmentType,
              onNoticePeriod,
              leaveQuotaOverrides: {
                customQuotas: parsedCustom,
                carryForwardHours: parsedCf,
                lwpDaysAdjustment,
                note,
              },
            });
          }}
        >
          <div className="modal-content" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="modal-form-grid">
              <div>
                <label>Employment Category (Tier)</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentTier)}
                >
                  {EMPLOYMENT_TIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Manual LWP Deduction Adjustment (Days)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={lwpDaysAdjustment}
                  onChange={(e) => setLwpDaysAdjustment(Number(e.target.value) || 0)}
                />
              </div>
              <div className="full-span">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={onNoticePeriod}
                    onChange={(e) => setOnNoticePeriod(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  <span>
                    Currently on Notice Period (blocks employee half-day / full-day
                    leave requests per Section 10)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px" }}>
                Per-Type Hour Overrides & Management Carry-Forward Bonus
              </h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Tier Default</th>
                      <th>Custom Quota (blank = default)</th>
                      <th>Carry-Forward Bonus (+hrs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policy.leaveTypes
                      .filter((lt) => lt.active)
                      .map((lt) => (
                        <tr key={lt.key}>
                          <td style={{ fontWeight: 600 }}>{lt.name}</td>
                          <td>{lt.quotas[employmentType]} hrs</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              placeholder={String(lt.quotas[employmentType])}
                              value={customQuotas[lt.key] ?? ""}
                              onChange={(e) =>
                                setCustomQuotas({
                                  ...customQuotas,
                                  [lt.key]: e.target.value,
                                })
                              }
                              style={{ width: "100px", padding: "6px 8px" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={carryForwardHours[lt.key] ?? ""}
                              onChange={(e) =>
                                setCarryForwardHours({
                                  ...carryForwardHours,
                                  [lt.key]: e.target.value,
                                })
                              }
                              style={{ width: "100px", padding: "6px 8px" }}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label>HR / Management Override Note</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Approved 8 hrs carry-forward by Management (Sec 3)"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save Employee Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SUB-MODAL 4: PUBLIC HOLIDAY EDITOR (HR & ADMIN)
--------------------------------------------------------- */
function HolidayEditorModal({
  draft,
  busy,
  onClose,
  onSubmit,
}: {
  draft: Partial<PublicHolidayRecord>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => void;
}) {
  const [date, setDate] = useState(
    draft.date || new Date().toISOString().split("T")[0]
  );
  const [name, setName] = useState(draft.name || "");
  const [type, setType] = useState(draft.type || "Official Holiday");
  const [syncedJibble, setSyncedJibble] = useState(draft.syncedJibble !== false);
  const [notes, setNotes] = useState(draft.notes || "");

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: "460px" }}>
        <div className="modal-head">
          <h2>{draft.id ? "Edit Public Holiday" : "Add Public Holiday"}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              action: "saveHoliday",
              id: draft.id,
              date,
              name,
              type,
              syncedJibble,
              notes,
            });
          }}
        >
          <div className="modal-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label>Holiday Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Holiday Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Independence Day, Diwali"
                required
              />
            </div>
            <div>
              <label>Category</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Official Holiday">Official Holiday</option>
                <option value="Optional Holiday">Optional Holiday</option>
                <option value="Company Event">Company Event</option>
              </select>
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={syncedJibble}
                  onChange={(e) => setSyncedJibble(e.target.checked)}
                  style={{ width: "auto" }}
                />
                <span>Updated & published in Jibble</span>
              </label>
            </div>
            <div>
              <label>Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note..."
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SUB-MODAL 5: OFFICIAL HR POLICY DOCUMENT REFERENCE
--------------------------------------------------------- */
function OfficialPolicyReferenceModal({
  policy,
  onClose,
}: {
  policy: LeavePolicyData;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: "700px" }}>
        <div className="modal-head">
          <h2>{policy.policyTitle}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-content" style={{ maxHeight: "75vh", overflowY: "auto", fontSize: "13px", lineHeight: 1.55, color: "#1e293b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #e2e8f0" }}>
            <div>
              <div><strong>Effective Date:</strong> {policy.effectiveDate}</div>
              <div><strong>Issued By:</strong> {policy.issuedBy}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div><strong>Approved By:</strong> {policy.approvedBy}</div>
              <div><strong>Workday Standard:</strong> {policy.standardWorkdayHours} hrs/day</div>
            </div>
          </div>

          <p><strong>1. Purpose & Scope:</strong> Outlines leave, attendance, shift management, and compliance guidelines for Managers, Full-Time, Part-Time, Probationary Employees, and Interns.</p>

          <div className="table-responsive" style={{ margin: "12px 0" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Manager</th>
                  <th>Full-Time</th>
                  <th>Part-Time / Intern / Probation</th>
                </tr>
              </thead>
              <tbody>
                {policy.leaveTypes
                  .filter((lt) => lt.active)
                  .map((lt) => (
                    <tr key={lt.key}>
                      <td style={{ fontWeight: 600 }}>{lt.name}</td>
                      <td>{lt.quotas.manager > 0 ? `${lt.quotas.manager} hrs` : "-"}</td>
                      <td>{lt.quotas.full_time > 0 ? `${lt.quotas.full_time} hrs` : "-"}</td>
                      <td>
                        {lt.quotas.part_time || lt.quotas.intern || lt.quotas.probationary
                          ? `${lt.quotas.part_time} / ${lt.quotas.intern} / ${lt.quotas.probationary} hrs`
                          : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <p><strong>3. Annual Leave Entitlement:</strong> {policy.guidelinesNotes.annualEntitlement}</p>
          <p><strong>4. Leave Guidelines:</strong></p>
          <ul style={{ margin: "4px 0 10px 18px" }}>
            {policy.leaveTypes
              .filter((lt) => lt.active && lt.guideline)
              .map((lt) => (
                <li key={lt.key}>
                  <strong>{lt.name}:</strong> {lt.guideline}
                </li>
              ))}
          </ul>
          <p><strong>5. Leave Approval Process:</strong> {policy.guidelinesNotes.approvalProcess}</p>
          <p><strong>6. Attendance & Shift Policy:</strong> {policy.guidelinesNotes.attendanceShift}</p>
          <p><strong>7. Leave Approval Conditions:</strong> {policy.guidelinesNotes.approvalConditions}</p>
          <p><strong>8. Unauthorised Absence & LWP:</strong> {policy.guidelinesNotes.unauthorizedLwp}</p>
          <p><strong>9. Half-Day Leave:</strong> {policy.guidelinesNotes.halfDay}</p>
          <p><strong>10. Notice Period:</strong> {policy.guidelinesNotes.noticePeriod}</p>
          <p><strong>11. Public Holidays:</strong> {policy.guidelinesNotes.holidays}</p>
          <p><strong>12. Policy Compliance:</strong> {policy.guidelinesNotes.compliance}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
