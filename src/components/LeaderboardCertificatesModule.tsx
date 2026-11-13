"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import PerformanceDateFilterBar from "./PerformanceDateFilterBar";
import {
  EmployeePeriodMetrics,
  PerformanceDatePreset,
  ResolvedPerformanceRange,
  getTodayIso,
} from "@/lib/performance-analytics";

type IndividualAssessment = {
  mode: "individual";
  provider: string;
  range: ResolvedPerformanceRange;
  employee: {
    id: number;
    name: string;
    email: string;
    team: string;
    role: string;
    employmentType: string;
  };
  metrics: EmployeePeriodMetrics;
  assessment: {
    overallRating: string;
    readinessTag: string;
    executiveSummary: string;
    strengths: string[];
    areasToImprove: string[];
    focusTopics: string[];
    actionPlan: Array<{
      focusArea: string;
      recommendation: string;
      priority: "High" | "Medium" | "Low";
    }>;
    certificateGuidance: string;
  };
};

type TeamAssessment = {
  mode: "team";
  provider: string;
  range: ResolvedPerformanceRange;
  teamStandingsSummary: {
    totalEmployees: number;
    overallAvgPct: number;
    totalVerifiedUnits: number;
    totalPeriodTarget: number;
    activeClarifications: number;
  };
  assessment: {
    teamHealthRating: string;
    executiveSummary: string;
    topHighlights: string[];
    improvementPriorities: Array<{
      employeeName: string;
      team: string;
      gapArea: string;
      whatToWorkOn: string;
      priority: "High" | "Medium" | "Low";
    }>;
    managerRecommendations: string[];
  };
};

type AssessmentResult = IndividualAssessment | TeamAssessment;

type Props = {
  rankedMetrics: EmployeePeriodMetrics[];
  winnersIds: number[];
  isAdmin: boolean;
  sessionEmployeeId: number;
  searchQuery: string;
  perfPreset: PerformanceDatePreset;
  customStart: string;
  customEnd: string;
  resolvedRange: ResolvedPerformanceRange;
  onPresetChange: (preset: PerformanceDatePreset) => void;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
  onGenerateCertificate: (employeeId: number, isWinner: boolean) => void;
};

function getRatingPillClass(rating: string): string {
  const r = rating.toLowerCase();
  if (r.includes("exceed") || r.includes("high")) return "verified";
  if (r.includes("strong") || r.includes("steady") || r.includes("on track")) return "present";
  if (r.includes("developing")) return "pending";
  return "needs-clarification";
}

function getBandPillClass(band: EmployeePeriodMetrics["performanceBand"]): string {
  if (band === "Exceeding") return "verified";
  if (band === "On Track") return "present";
  if (band === "Needs Attention") return "pending";
  return "rejected";
}

export default function LeaderboardCertificatesModule({
  rankedMetrics,
  winnersIds,
  isAdmin,
  sessionEmployeeId,
  searchQuery,
  perfPreset,
  customStart,
  customEnd,
  resolvedRange,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
  onGenerateCertificate,
}: Props) {
  const [teamFilter, setTeamFilter] = useState<string>("All");
  const [selectedEmpId, setSelectedEmpId] = useState<number>(() => {
    const firstId = rankedMetrics[0]?.employeeId || sessionEmployeeId;
    return isAdmin ? firstId : sessionEmployeeId;
  });
  const [loadingMode, setLoadingMode] = useState<"individual" | "team" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AssessmentResult | null>(null);
  const aiPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedEmpId(sessionEmployeeId);
    } else if (
      rankedMetrics.length > 0 &&
      !rankedMetrics.some((m) => m.employeeId === selectedEmpId)
    ) {
      setSelectedEmpId(rankedMetrics[0].employeeId);
    }
  }, [isAdmin, rankedMetrics, selectedEmpId, sessionEmployeeId]);

  const teams = Array.from(new Set(rankedMetrics.map((m) => m.team))).filter(Boolean);

  const visibleRanked = rankedMetrics.filter((m) => {
    if (isAdmin && teamFilter !== "All" && m.team !== teamFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.team.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const periodTotalUnits = visibleRanked.reduce((sum, m) => sum + m.periodDone, 0);
  const periodTotalTarget = visibleRanked.reduce((sum, m) => sum + m.periodTarget, 0);
  const periodAvgPct = visibleRanked.length
    ? Math.round(
        visibleRanked.reduce((sum, m) => sum + m.achievementPct, 0) /
          visibleRanked.length
      )
    : 0;
  const periodClarifications = visibleRanked.reduce(
    (sum, m) => sum + m.clarificationLogsCount,
    0
  );

  const aiCache = useRef<Record<string, AssessmentResult>>({});

  const isRangeStale =
    aiResult !== null &&
    (aiResult.range.preset !== resolvedRange.preset ||
      aiResult.range.startDate !== resolvedRange.startDate ||
      aiResult.range.endDate !== resolvedRange.endDate);

  const runAssessment = async (
    mode: "individual" | "team",
    targetId?: number,
    forceRefresh = false
  ) => {
    const resolvedEmpId = targetId || selectedEmpId || sessionEmployeeId;
    if (mode === "individual" && resolvedEmpId) {
      setSelectedEmpId(resolvedEmpId);
    }

    const cacheKey = `${mode}_${mode === "individual" ? resolvedEmpId : "team"}_${perfPreset}_${
      perfPreset === "custom" ? `${customStart}_${customEnd}` : ""
    }`;

    // Instant 0ms cache hit
    if (!forceRefresh && aiCache.current[cacheKey]) {
      setAiResult(aiCache.current[cacheKey]);
      setAiError(null);
      setTimeout(() => {
        aiPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 40);
      return;
    }

    setLoadingMode(mode);
    setAiError(null);

    setTimeout(() => {
      aiPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);

    try {
      const res = await fetch("/api/ai/performance-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          employeeId: mode === "individual" ? resolvedEmpId : undefined,
          preset: perfPreset,
          startDate: perfPreset === "custom" ? customStart : undefined,
          endDate: perfPreset === "custom" ? customEnd : undefined,
          todayIso: getTodayIso(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAiError(data?.error || "Failed to generate AI assessment.");
      } else {
        aiCache.current[cacheKey] = data as AssessmentResult;
        setAiResult(data as AssessmentResult);
      }
    } catch {
      setAiError("Network error while running AI performance assessment.");
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <>
      <div className="module-header">
        <div className="header-text">
          <h1>Performance Leaderboard & Certificates</h1>
          <p>
            Track output over custom windows, run AI performance & coaching reviews, and issue verified certificates.
          </p>
        </div>
        <div className="header-actions">
          {rankedMetrics.length > 0 && (
            <button
              type="button"
              className="btn-ai-organize"
              disabled={loadingMode !== null}
              onClick={() => runAssessment("individual", selectedEmpId)}
            >
              <Sparkles size={14} />
              <span>
                {loadingMode === "individual"
                  ? "Analyzing..."
                  : isAdmin
                  ? "AI Assess Selected"
                  : "AI Assess My Performance"}
              </span>
            </button>
          )}
          {isAdmin && rankedMetrics.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              disabled={loadingMode !== null}
              onClick={() => runAssessment("team")}
            >
              <Users size={14} />
              <span>
                {loadingMode === "team" ? "Reviewing Team..." : "Team AI Review"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Date Range Filter */}
      <PerformanceDateFilterBar
        preset={perfPreset}
        customStart={customStart}
        customEnd={customEnd}
        resolvedRange={resolvedRange}
        onPresetChange={onPresetChange}
        onCustomStartChange={onCustomStartChange}
        onCustomEndChange={onCustomEndChange}
      />

      {/* Period Performance Summary Cards */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">
              {isAdmin ? "Period Achievement Avg" : "Your Period Score"}
            </span>
            <div className="metric-icon-wrap">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="metric-value">{periodAvgPct}%</div>
          <div className="metric-sub">
            <span>{resolvedRange.shortLabel}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Verified Units (Period)</span>
            <div className="metric-icon-wrap">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="metric-value">
            {periodTotalUnits}{" "}
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
              / {periodTotalTarget}
            </span>
          </div>
          <div className="metric-sub">
            <span>
              {resolvedRange.dayCount
                ? `Prorated for ${resolvedRange.dayCount} day(s)`
                : "Full monthly target basis"}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Clarifications in Window</span>
            <div className="metric-icon-wrap">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="metric-value">{periodClarifications}</div>
          <div className="metric-sub">
            <span>Flagged logs requiring follow-up</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Evaluated Personnel</span>
            <div className="metric-icon-wrap">
              <Award size={16} />
            </div>
          </div>
          <div className="metric-value">{visibleRanked.length}</div>
          <div className="metric-sub">
            <span>
              {winnersIds.length > 0
                ? `${winnersIds.length} top ranker(s) in window`
                : "Awaiting verified deliverables"}
            </span>
          </div>
        </div>
      </div>

      {/* Department Filter + Leaderboard Table */}
      <div className="card-panel">
        <div className="card-header">
          <div className="card-title">
            <Award size={16} />
            <span>Standings — {resolvedRange.label}</span>
          </div>

          {isAdmin && teams.length > 1 && (
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${teamFilter === "All" ? "active" : ""}`}
                onClick={() => setTeamFilter("All")}
              >
                All Teams
              </button>
              {teams.map((tm) => (
                <button
                  key={tm}
                  type="button"
                  className={`filter-pill ${teamFilter === tm ? "active" : ""}`}
                  onClick={() => setTeamFilter(tm)}
                >
                  {tm}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {visibleRanked.length === 0 ? (
            <div className="empty-box">
              <div className="empty-icon">
                <Award size={22} />
              </div>
              <div className="empty-title">No leaderboard standings available</div>
              <div className="empty-desc">
                Leaderboard ranks update as employees record verified performance in the selected date window.
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team Member</th>
                    <th>Department</th>
                    <th>Verified vs Target</th>
                    <th>Activity & Hours</th>
                    <th>Achievement</th>
                    <th>AI & Recognition</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRanked.map((m, index) => {
                    const isTop = index === 0 && m.achievementPct > 0;
                    const isWinner = winnersIds.includes(m.employeeId);
                    return (
                      <tr key={m.employeeId}>
                        <td
                          style={{
                            fontWeight: 700,
                            color: isTop ? "#d97706" : "#64748b",
                          }}
                        >
                          #{index + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {m.role}
                          </div>
                        </td>
                        <td>{m.team}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {m.periodDone} / {m.periodTarget} units
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {resolvedRange.dayCount
                              ? `Monthly: ${m.monthlyTarget} • Pace: ${m.pacePerActiveDay}/day`
                              : `Pace: ${m.pacePerActiveDay}/active day`}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "12px", color: "#334155" }}>
                            {m.verifiedLogsCount} verified
                            {m.pendingLogsCount > 0 ? ` • ${m.pendingLogsCount} pending` : ""}
                            {m.clarificationLogsCount > 0
                              ? ` • ${m.clarificationLogsCount} clarify`
                              : ""}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {m.presentDays} present day(s) • {m.totalDutyHours}h logged
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                            <span
                              className={`status-pill ${
                                m.achievementPct >= 85 ? "verified" : "pending"
                              }`}
                            >
                              {m.achievementPct}% Achieved
                            </span>
                            <span
                              className={`status-pill ${getBandPillClass(m.performanceBand)}`}
                              style={{ fontSize: "10px", padding: "2px 7px" }}
                            >
                              {m.performanceBand}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn-ai-organize"
                              disabled={loadingMode !== null}
                              onClick={() => runAssessment("individual", m.employeeId)}
                              title={`Run AI assessment for ${m.name} (${resolvedRange.shortLabel})`}
                            >
                              <Sparkles size={13} />
                              <span>
                                {loadingMode === "individual" && selectedEmpId === m.employeeId
                                  ? "Analyzing..."
                                  : "AI Assess"}
                              </span>
                            </button>

                            {m.achievementPct > 0 ? (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() =>
                                  onGenerateCertificate(m.employeeId, isWinner)
                                }
                              >
                                <Printer size={13} />
                                <span>Certificate</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled
                                style={{ opacity: 0.5, cursor: "not-allowed" }}
                                title="Verified performance above 0% in selected range required"
                              >
                                <Lock size={12} />
                                <span>Requires &gt;0%</span>
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
          )}
        </div>
      </div>

      {/* AI Performance Assessment & Coaching Panel */}
      <div className="card-panel" ref={aiPanelRef}>
        <div className="card-header" style={{ flexWrap: "wrap", gap: "10px" }}>
          <div className="card-title">
            <Sparkles size={16} style={{ color: "#2563eb" }} />
            <span>AI Performance Assessment & Improvement Coaching</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {isAdmin && rankedMetrics.length > 0 && (
              <select
                className="search-input"
                style={{
                  width: "auto",
                  minWidth: "200px",
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(Number(e.target.value))}
              >
                {rankedMetrics.map((m) => (
                  <option key={m.employeeId} value={m.employeeId}>
                    {m.name} ({m.team}) — {m.achievementPct}%
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="btn-ai-organize"
              disabled={loadingMode !== null || rankedMetrics.length === 0}
              onClick={() => runAssessment("individual", selectedEmpId)}
            >
              <Sparkles size={13} />
              <span>
                {loadingMode === "individual"
                  ? "Generating Assessment..."
                  : isAdmin
                  ? "Assess Employee"
                  : "Assess My Performance"}
              </span>
            </button>

            {isAdmin && rankedMetrics.length > 0 && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={loadingMode !== null}
                onClick={() => runAssessment("team")}
              >
                <Users size={13} />
                <span>
                  {loadingMode === "team" ? "Analyzing Team..." : "Analyze Full Team"}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="card-body">
          {aiError && (
            <div className="login-error-msg" style={{ marginBottom: "14px" }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{aiError}</span>
            </div>
          )}

          {isRangeStale && !loadingMode && aiResult && (
            <div className="ai-tip-box" style={{ marginBottom: "14px", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>
                  Tracking period changed to <strong>{resolvedRange.label}</strong> since this assessment was generated ({aiResult.range.shortLabel}).
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  runAssessment(
                    aiResult.mode,
                    aiResult.mode === "individual" ? aiResult.employee.id : undefined
                  )
                }
              >
                <RefreshCw size={12} />
                <span>Refresh for Current Dates</span>
              </button>
            </div>
          )}

          {loadingMode && (
            <div className="empty-box" style={{ padding: "32px 16px" }}>
              <Sparkles size={24} style={{ color: "#2563eb", marginBottom: "8px" }} />
              <div className="empty-title">
                {loadingMode === "team"
                  ? "Generating Team Performance & Coaching Review..."
                  : "Analyzing Verified Logs, Targets & Improvement Areas..."}
              </div>
              <div className="empty-desc">
                Evaluating data across {resolvedRange.label}.
              </div>
            </div>
          )}

          {!loadingMode && !aiResult && (
            <div className="empty-box" style={{ padding: "28px 16px" }}>
              <ClipboardCheck size={24} style={{ color: "#2563eb", marginBottom: "8px" }} />
              <div className="empty-title">Ready to Assess Performance</div>
              <div className="empty-desc" style={{ maxWidth: "560px", margin: "4px auto 12px" }}>
                Click <strong>AI Assess</strong> on any employee row above (or choose a 7-day, 15-day, or custom date range) to review strengths, target pacing gaps, and exact areas to work on.
              </div>
            </div>
          )}

          {!loadingMode && aiResult?.mode === "individual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Top Meta Header */}
              <div className="ai-assess-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      {aiResult.employee.name}
                    </h3>
                    <span className={`status-pill ${getRatingPillClass(aiResult.assessment.overallRating)}`}>
                      {aiResult.assessment.overallRating}
                    </span>
                    <span className="ai-chip">{aiResult.assessment.readinessTag}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    {aiResult.employee.role} • {aiResult.employee.team} • Window:{" "}
                    <strong>{aiResult.range.label}</strong>
                  </div>
                </div>

                {aiResult.metrics.achievementPct > 0 && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      onGenerateCertificate(
                        aiResult.employee.id,
                        winnersIds.includes(aiResult.employee.id)
                      )
                    }
                  >
                    <Printer size={13} />
                    <span>Open Period Certificate</span>
                  </button>
                )}
              </div>

              {/* Grounded Metrics Bar */}
              <div className="ai-metrics-strip">
                <div>
                  <span>Verified Output</span>
                  <strong>
                    {aiResult.metrics.periodDone} / {aiResult.metrics.periodTarget} units (
                    {aiResult.metrics.achievementPct}%)
                  </strong>
                </div>
                <div>
                  <span>Verification Rate</span>
                  <strong>
                    {aiResult.metrics.verificationRatePct}% ({aiResult.metrics.verifiedLogsCount}/
                    {aiResult.metrics.totalLogsCount} logs)
                  </strong>
                </div>
                <div>
                  <span>Clarification Flags</span>
                  <strong>{aiResult.metrics.clarificationLogsCount} log(s)</strong>
                </div>
                <div>
                  <span>Pace vs Target</span>
                  <strong>
                    {aiResult.metrics.pacePerActiveDay}/day vs {aiResult.metrics.requiredPerDay}/day
                  </strong>
                </div>
                <div>
                  <span>Attendance</span>
                  <strong>
                    {aiResult.metrics.presentDays}d • {aiResult.metrics.totalDutyHours}h
                  </strong>
                </div>
              </div>

              {/* Summary */}
              <div className="ai-summary-card" style={{ marginTop: 0, padding: "12px 14px", fontSize: "13px", lineHeight: 1.55 }}>
                {aiResult.assessment.executiveSummary}
              </div>

              {/* Strengths & Where to Improve */}
              <div className="ai-two-col">
                <div className="ai-feedback-box strengths">
                  <h4>
                    <CheckCircle2 size={15} />
                    <span>Key Strengths</span>
                  </h4>
                  <ul>
                    {aiResult.assessment.strengths.length > 0 ? (
                      aiResult.assessment.strengths.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))
                    ) : (
                      <li>Consistent participation in tracked tasks.</li>
                    )}
                  </ul>
                </div>

                <div className="ai-feedback-box improve">
                  <h4>
                    <Target size={15} />
                    <span>Where to Improve &amp; Work On</span>
                  </h4>
                  <ul>
                    {aiResult.assessment.areasToImprove.length > 0 ? (
                      aiResult.assessment.areasToImprove.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))
                    ) : (
                      <li>Maintain verification consistency and target pace.</li>
                    )}
                  </ul>

                  {aiResult.assessment.focusTopics.length > 0 && (
                    <div style={{ marginTop: "10px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#92400e", marginBottom: "6px" }}>
                        Focus Areas Next:
                      </div>
                      <div className="ai-chip-list">
                        {aiResult.assessment.focusTopics.map((topic, idx) => (
                          <span key={idx} className="ai-chip" style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Plan & Certificate Guidance */}
              {aiResult.assessment.actionPlan.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                    Recommended Action Plan
                  </div>
                  <div className="ai-action-grid">
                    {aiResult.assessment.actionPlan.map((step, idx) => (
                      <div key={idx} className="ai-action-card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "12px", color: "#0f172a" }}>
                            {step.focusArea}
                          </strong>
                          <span
                            className={`status-pill ${
                              step.priority === "High"
                                ? "needs-clarification"
                                : step.priority === "Medium"
                                ? "pending"
                                : "present"
                            }`}
                            style={{ fontSize: "10px", padding: "2px 7px" }}
                          >
                            {step.priority} Priority
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: 1.45 }}>
                          {step.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontSize: "12px", color: "#475569", padding: "10px 12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <strong>Certificate & Recognition Guidance:</strong>{" "}
                {aiResult.assessment.certificateGuidance}
              </div>
            </div>
          )}

          {!loadingMode && aiResult?.mode === "team" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="ai-assess-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      Workforce Leaderboard Review
                    </h3>
                    <span className={`status-pill ${getRatingPillClass(aiResult.assessment.teamHealthRating)}`}>
                      {aiResult.assessment.teamHealthRating}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    Evaluation Window: <strong>{aiResult.range.label}</strong>
                  </div>
                </div>
              </div>

              <div className="ai-metrics-strip">
                <div>
                  <span>Personnel Evaluated</span>
                  <strong>{aiResult.teamStandingsSummary.totalEmployees}</strong>
                </div>
                <div>
                  <span>Avg Period Score</span>
                  <strong>{aiResult.teamStandingsSummary.overallAvgPct}%</strong>
                </div>
                <div>
                  <span>Verified Output</span>
                  <strong>
                    {aiResult.teamStandingsSummary.totalVerifiedUnits} /{" "}
                    {aiResult.teamStandingsSummary.totalPeriodTarget} units
                  </strong>
                </div>
                <div>
                  <span>Open Clarifications</span>
                  <strong>{aiResult.teamStandingsSummary.activeClarifications}</strong>
                </div>
              </div>

              <div className="ai-summary-card" style={{ marginTop: 0, padding: "12px 14px", fontSize: "13px", lineHeight: 1.55 }}>
                {aiResult.assessment.executiveSummary}
              </div>

              <div className="ai-two-col">
                <div className="ai-feedback-box strengths">
                  <h4>
                    <CheckCircle2 size={15} />
                    <span>Top Highlights</span>
                  </h4>
                  <ul>
                    {aiResult.assessment.topHighlights.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="ai-feedback-box improve">
                  <h4>
                    <ClipboardCheck size={15} />
                    <span>Process &amp; Manager Recommendations</span>
                  </h4>
                  <ul>
                    {aiResult.assessment.managerRecommendations.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {aiResult.assessment.improvementPriorities.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                    Individual Coaching &amp; Improvement Priorities
                  </div>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Gap Identified</th>
                          <th>Where to Work On</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiResult.assessment.improvementPriorities.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{item.employeeName}</td>
                            <td>{item.team}</td>
                            <td>{item.gapArea}</td>
                            <td style={{ color: "#334155" }}>{item.whatToWorkOn}</td>
                            <td>
                              <span
                                className={`status-pill ${
                                  item.priority === "High"
                                    ? "needs-clarification"
                                    : item.priority === "Medium"
                                    ? "pending"
                                    : "present"
                                }`}
                              >
                                {item.priority}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
