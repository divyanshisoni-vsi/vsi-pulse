"use client";

import React, { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import Chart from "chart.js/auto";
import {
  LayoutDashboard,
  ClipboardList,
  Target,
  Users,
  CalendarCheck,
  Award,
  FileText,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  Menu,
  Shield,
  UserCheck,
  LogOut,
  FolderDown,
  Activity,
  Layers,
  ChevronRight,
  TrendingUp,
  KeyRound,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";

// Types
export type Employee = {
  id: number;
  name: string;
  email: string;
  team: string;
  role: string;
  accessRole?: "Admin" | "Employee";
  target: number;
  done: number;
  status: string;
};

export type DailyLog = {
  id: number;
  date: string;
  employeeId: number;
  activity: string;
  quantity: number;
  status: string;
  source: string;
  notes?: string;
  verifiedAt?: string | null;
};

export type Attendance = {
  id: number;
  date: string;
  employeeId: number;
  hours: number;
  status: string;
};

export type Kpi = {
  id: number;
  team: string;
  name: string;
  target: number;
  weight: number;
};

export type AlertItem = {
  id: number;
  type: string;
  text: string;
  status: string;
};

export type AuditItem = {
  id: number;
  at: string;
  actor: string;
  action: string;
  details: string;
};

export type AppDb = {
  employees: Employee[];
  logs: DailyLog[];
  attendance: Attendance[];
  kpis: Kpi[];
  alerts: AlertItem[];
  audit: AuditItem[];
};

type Props = {
  initialUser: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    id?: string | null;
  };
};

function ChangePasswordModal({
  closeModal,
  userEmail,
}: {
  closeModal: () => void;
  userEmail: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Failed to update password.");
      } else {
        setSuccess(true);
      }
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <div className="modal-dialog" style={{ maxWidth: "440px" }}>
      <div className="modal-head">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <KeyRound size={17} style={{ color: "#2563eb" }} />
          <h2>Change Password</h2>
        </div>
        <button className="modal-close-btn" onClick={closeModal}>
          <X size={18} />
        </button>
      </div>

      <div className="modal-content">
        {success ? (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <CheckCircle2 size={40} style={{ color: "#10b981", margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Password Changed!
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#64748b" }}>
              Your account password has been updated. Please remember your new password for your next login.
            </p>
            <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={closeModal}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Changing password for: <strong>{userEmail}</strong>
            </p>

            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            {error && (
              <div className="login-error-msg">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-actions" style={{ padding: "12px 0 0 0", marginTop: "4px" }}>
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DailyLogModal({
  old,
  id,
  isAdmin,
  sessionEmail,
  sessionEmployeeId,
  employees,
  closeModal,
  onSave,
}: {
  old: Partial<DailyLog>;
  id?: number;
  isAdmin: boolean;
  sessionEmail: string;
  sessionEmployeeId: number;
  employees: Employee[];
  closeModal: () => void;
  onSave: (recordId: number, data: Record<string, any>) => void;
}) {
  const [date, setDate] = useState(
    old.date || new Date().toISOString().split("T")[0]
  );
  const [employeeId, setEmployeeId] = useState<number>(
    old.employeeId || (!isAdmin ? sessionEmployeeId : employees[0]?.id || 1)
  );
  const [activity, setActivity] = useState(old.activity || "");
  const [quantity, setQuantity] = useState<number>(old.quantity ?? 1);
  const [status, setStatus] = useState(
    old.status || (isAdmin ? "Verified" : "Pending")
  );
  const [source, setSource] = useState(old.source || "Web Portal Submission");
  const [notes, setNotes] = useState(old.notes || "");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiMeta, setAiMeta] = useState<{
    detectedItems: string[];
    needsMoreDetail: boolean;
    clarificationTip: string;
    previousActivity: string;
    previousQuantity: number;
  } | null>(null);

  const selectedEmployee = employees.find((e) => e.id === Number(employeeId));

  async function handleAiStructure() {
    setAiError("");
    if (!activity.trim() || activity.trim().length < 3) {
      setAiError("Please write a short note of what you worked on first.");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/structure-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: activity,
          team: selectedEmployee?.team,
          role: selectedEmployee?.role,
        }),
      });

      if (res.redirected || res.url.includes("/login")) {
        setAiLoading(false);
        setAiError("Your session expired. Please refresh the page and sign in again.");
        return;
      }

      const rawResponse = await res.text();
      let data: any = null;
      try {
        data = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        data = null;
      }
      setAiLoading(false);

      if (!res.ok) {
        setAiError(
          data?.error ||
            `AI assistant returned HTTP ${res.status}. Please try again in a moment.`
        );
        return;
      }

      if (!data) {
        setAiError("Received an invalid response from the AI assistant.");
        return;
      }

      setAiMeta({
        detectedItems: data.detectedItems || [],
        needsMoreDetail: Boolean(data.needsMoreDetail),
        clarificationTip: data.clarificationTip || "",
        previousActivity: activity,
        previousQuantity: quantity,
      });

      if (data.structuredActivity) {
        setActivity(data.structuredActivity);
      }
      if (typeof data.estimatedUnits === "number" && data.estimatedUnits > 0) {
        setQuantity(data.estimatedUnits);
      }
    } catch {
      setAiLoading(false);
      setAiError("Network error while contacting AI assistant.");
    }
  }

  function handleUndoAi() {
    if (!aiMeta) return;
    setActivity(aiMeta.previousActivity);
    setQuantity(aiMeta.previousQuantity);
    setAiMeta(null);
    setAiError("");
  }

  return (
    <div className="modal-dialog">
      <div className="modal-head">
        <h2>{id ? "Edit Daily Activity Log" : "New Daily Activity Log"}</h2>
        <button className="modal-close-btn" onClick={closeModal}>
          <X size={18} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const finalStatus =
            !isAdmin && old.status === "Needs clarification"
              ? "Pending"
              : status;
          onSave(id || 0, {
            date,
            employeeId: isAdmin ? Number(employeeId) : sessionEmployeeId,
            activity,
            quantity: Number(quantity) || 0,
            status: finalStatus,
            source,
            notes,
          });
        }}
      >
        <div className="modal-content">
          <div className="modal-form-grid">
            {old.notes && (
              <div
                className="full-span"
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                <AlertCircle
                  size={18}
                  style={{
                    color: "#d97706",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#92400e",
                    }}
                  >
                    Manager Clarification Request:
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#b45309",
                      marginTop: "2px",
                    }}
                  >
                    {old.notes}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label>Activity Date</label>
              <input
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {isAdmin ? (
              <div>
                <label>Team Member</label>
                <select
                  name="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(Number(e.target.value))}
                  required
                >
                  {employees.length > 0 ? (
                    employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.team})
                      </option>
                    ))
                  ) : (
                    <option value="1">Primary User</option>
                  )}
                </select>
              </div>
            ) : (
              <div>
                <label>Reporting As</label>
                <input
                  value={sessionEmail}
                  disabled
                  style={{ background: "#f1f5f9" }}
                />
              </div>
            )}

            <div className="full-span">
              <div className="activity-label-row">
                <label>Task / Activity Description</label>
                <button
                  type="button"
                  className="btn-ai-organize"
                  onClick={handleAiStructure}
                  disabled={aiLoading || !activity.trim()}
                  title="Format rough notes into clean bullet points and extract completed units"
                >
                  <Sparkles size={13} />
                  <span>{aiLoading ? "Organizing…" : "Structure with AI"}</span>
                </button>
              </div>
              <textarea
                name="activity"
                rows={4}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="Type rough notes (e.g. checked 18 listings fixed 4 pricing errors updated tracker sheet) and click 'Structure with AI'..."
                required
              />

              {aiError && (
                <div className="login-error-msg" style={{ marginTop: "8px" }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{aiError}</span>
                </div>
              )}

              {aiMeta && (
                <div className="ai-summary-card">
                  <div className="ai-summary-header">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Sparkles size={13} />
                      Organized with AI — please verify details before saving
                    </span>
                    <button
                      type="button"
                      className="ai-undo-btn"
                      onClick={handleUndoAi}
                    >
                      Undo
                    </button>
                  </div>
                  {aiMeta.detectedItems.length > 0 && (
                    <div className="ai-chip-list">
                      {aiMeta.detectedItems.map((item, idx) => (
                        <span key={idx} className="ai-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {aiMeta.needsMoreDetail && aiMeta.clarificationTip && (
                    <div className="ai-tip-box">
                      <AlertCircle size={13} style={{ flexShrink: 0 }} />
                      <span>{aiMeta.clarificationTip}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label>Units Completed</label>
              <input
                name="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min="0"
                required
              />
            </div>

            <div>
              <label>Verification Status</label>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!isAdmin}
              >
                <option value="Verified">Verified</option>
                <option value="Needs clarification">Needs clarification</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="full-span">
              <label>Source / Channel</label>
              <input
                name="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
              />
            </div>

            <div className="full-span">
              <label>
                {isAdmin
                  ? "Review Notes / Clarification Feedback"
                  : "Clarification Details / Response"}
              </label>
              <textarea
                name="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isAdmin
                    ? "Add feedback or review notes..."
                    : "Provide sheet link, test case details, or answer questions..."
                }
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save Record
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PrototypeApp({ initialUser }: Props) {
  // Database state - initial zero data
  const [db, setDb] = useState<AppDb>({
    employees: [],
    logs: [],
    attendance: [],
    kpis: [],
    alerts: [],
    audit: [],
  });

  const [currentTab, setCurrentTab] = useState<string>("Dashboard");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<React.ReactNode | null>(null);

  // User session & Role handling: strictly enforced from authenticated database session
  const sessionEmail = initialUser.email || "divyanshisoni@virtualsolutionsindia.com";
  const userRole: "Admin" | "Employee" =
    initialUser.role?.toLowerCase() === "employee" ? "Employee" : "Admin";
  const sessionEmployeeId = initialUser.id ? Number(initialUser.id) : 1;

  const isAdmin = userRole === "Admin";

  // Dashboard View Switcher: Performance Overview vs Leave & Attendance Overview
  const [dashboardView, setDashboardView] = useState<"performance" | "leave">("performance");

  // Daily Logs Filter: All, Needs clarification, Pending, Verified
  const [logFilter, setLogFilter] = useState<"All" | "Needs clarification" | "Pending" | "Verified">("All");

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const leaveDoughnutRef = useRef<HTMLCanvasElement | null>(null);
  const leaveDoughnutInstance = useRef<Chart | null>(null);
  const leaveBarRef = useRef<HTMLCanvasElement | null>(null);
  const leaveBarInstance = useRef<Chart | null>(null);

  // 7 Navigation Modules (exact prototype naming)
  const navigationItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Daily Logs", icon: ClipboardList },
    { name: "KPI & Performance", icon: Target },
    { name: "Employee Directory", icon: Users },
    { name: "Attendance & Leave", icon: CalendarCheck },
    { name: "Leaderboard & Certificates", icon: Award },
    { name: "Reports & Audit", icon: FileText },
  ];

  // Fetch data from API
  const loadData = async () => {
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const data = await res.json();
        setDb({
          employees: data.employees || [],
          logs: data.logs || [],
          attendance: data.attendance || [],
          kpis: data.kpis || [],
          alerts: data.alerts || [],
          audit: data.audit || [],
        });
      }
    } catch (e) {
      console.error("Failed to load data from API:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper calculations
  const score = (e: Employee) =>
    e.target ? Math.min(100, Math.round((e.done / e.target) * 100)) : 0;

  const person = (id: number) => db.employees.find((e) => e.id === id);

  const visibleEmployees = () => {
    if (!isAdmin) {
      return db.employees.filter((e) => e.id === sessionEmployeeId);
    }
    return db.employees;
  };

  const visibleLogs = () => {
    if (!isAdmin) {
      return db.logs.filter((l) => l.employeeId === sessionEmployeeId);
    }
    return db.logs;
  };

  const visibleAttendance = () => {
    if (!isAdmin) {
      return db.attendance.filter((a) => a.employeeId === sessionEmployeeId);
    }
    return db.attendance;
  };

  const filterRows = <T,>(
    rows: T[],
    getters: ((item: T) => string | number | undefined)[]
  ) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      getters.some((g) => String(g(r) ?? "").toLowerCase().includes(q))
    );
  };

  const syncAudit = (action: string, details: string) => {
    const newAudit: AuditItem = {
      id: Date.now(),
      at: new Date().toLocaleString(),
      actor: sessionEmail,
      action,
      details,
    };
    setDb((prev) => ({ ...prev, audit: [newAudit, ...prev.audit] }));
  };

  // Modals
  const openModal = (content: React.ReactNode) => setActiveModal(content);
  const closeModal = () => setActiveModal(null);

  const openChangePasswordModal = () => {
    openModal(
      <ChangePasswordModal
        closeModal={closeModal}
        userEmail={sessionEmail}
      />
    );
  };

  // CRUD API Handlers
  const saveRecord = async (
    type: keyof AppDb,
    id: number,
    formData: Record<string, any>
  ) => {
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveRecord", type, id, record: formData }),
      });

      if (!res.ok) {
        // If API fails (e.g. backend offline), update local frontend state gracefully
        const fallbackId = id || Date.now();
        setDb((prev) => {
          const list = [...(prev[type] as any[])];
          const idx = list.findIndex((x) => x.id === id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...formData };
          } else {
            list.unshift({ id: fallbackId, ...formData });
          }
          return { ...prev, [type]: list };
        });
      }

      let resJson: any = null;
      if (res.ok) {
        try {
          resJson = await res.json();
        } catch {}
      }

      if (type === "employees" && !id && resJson?.welcomeEmailSent) {
        syncAudit(
          "Added Employee & Dispatched Credentials",
          `${formData.name} (${formData.email})`
        );
        window.alert(
          `Employee added successfully!\n\nAn official welcome email with initial login credentials has been sent to ${formData.email}.`
        );
      } else {
        syncAudit(
          id ? `Updated ${type}` : `Added ${type}`,
          formData.name || formData.activity || formData.type || "record"
        );
      }
      closeModal();
      loadData();
    } catch (err) {
      console.error("Save error:", err);
      // Fallback local update
      const fallbackId = id || Date.now();
      setDb((prev) => {
        const list = [...(prev[type] as any[])];
        const idx = list.findIndex((x) => x.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...formData };
        } else {
          list.unshift({ id: fallbackId, ...formData });
        }
        return { ...prev, [type]: list };
      });
      closeModal();
    }
  };

  const removeRecord = async (type: keyof AppDb, id: number) => {
    if (!isAdmin && type !== "logs") return;
    if (!window.confirm("Confirm deletion of this record?")) return;

    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeRecord", type, id }),
      });
      syncAudit(`Deleted ${type}`, String(id));
      loadData();
    } catch (err) {
      console.error("Delete error:", err);
      // Fallback local remove
      setDb((prev) => ({
        ...prev,
        [type]: (prev[type] as any[]).filter((x) => x.id !== id),
      }));
    }
  };

  const toggleAlert = async (id: number) => {
    if (!isAdmin) return;
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleAlert", id }),
      });
      syncAudit("Toggled alert", String(id));
      loadData();
    } catch (err) {
      console.error("Alert toggle error:", err);
      setDb((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === id
            ? { ...a, status: a.status === "Open" ? "Resolved" : "Open" }
            : a
        ),
      }));
    }
  };

  // 1-Click Fast Verification (Admin)
  const quickVerify = async (id: number) => {
    try {
      setDb((prev) => ({
        ...prev,
        logs: prev.logs.map((l) =>
          l.id === id ? { ...l, status: "Verified" } : l
        ),
      }));

      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verifyLog", id }),
      });
      syncAudit("Verified Daily Log", `Log ID #${id}`);
      loadData();
    } catch (err) {
      console.error("Quick verify error:", err);
      loadData();
    }
  };

  // 1-Click Clarification Request Modal (Admin)
  const openClarifyModal = (log: DailyLog) => {
    const emp = person(log.employeeId);
    const presets = [
      "Please provide deliverable link / spreadsheet row",
      "Confirm tested unit count and batch details",
      "Shift timing hours mismatch with logged quantity",
      "Please detail specific tickets / cases verified",
    ];

    openModal(
      <div className="modal-dialog">
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={18} style={{ color: "#f59e0b" }} />
            <h2>Request Clarification</h2>
          </div>
          <button className="modal-close-btn" onClick={closeModal}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const notes =
              (form.elements.namedItem("notes") as HTMLTextAreaElement)?.value ||
              "";

            try {
              setDb((prev) => ({
                ...prev,
                logs: prev.logs.map((l) =>
                  l.id === log.id
                    ? { ...l, status: "Needs clarification", notes }
                    : l
                ),
              }));
              closeModal();

              await fetch("/api/data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "requestClarification",
                  id: log.id,
                  notes,
                }),
              });
              syncAudit(
                "Requested Log Clarification",
                `${emp?.name || log.employeeId}: ${notes}`
              );
              loadData();
            } catch (err) {
              console.error("Clarification error:", err);
              loadData();
            }
          }}
        >
          <div className="modal-content">
            <div
              style={{
                background: "#f8fafc",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#64748b",
                  marginBottom: "4px",
                }}
              >
                <span>
                  <strong>Member:</strong> {emp?.name || `ID #${log.employeeId}`}
                </span>
                <span>
                  <strong>Date:</strong> {log.date}
                </span>
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#1e293b",
                  fontWeight: 500,
                }}
              >
                {log.activity} ({log.quantity} units)
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Quick Feedback Presets:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="quick-tag-btn"
                    onClick={() => {
                      const ta = document.getElementById(
                        "clarification-notes-input"
                      ) as HTMLTextAreaElement;
                      if (ta) ta.value = preset;
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#334155",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Feedback / What needs clarification:
              </label>
              <textarea
                id="clarification-notes-input"
                name="notes"
                rows={3}
                required
                placeholder="Explain what needs verification, missing spreadsheet links, or batch numbers..."
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{
                background: "#f59e0b",
                borderColor: "#f59e0b",
              }}
            >
              <AlertCircle size={14} />
              <span>Send Clarification Request</span>
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Certificate Modal
  const showCertificate = (id: number, winner: boolean) => {
    const e = person(id);
    if (!e) return;
    const sc = score(e);
    if (sc <= 0) {
      window.alert(
        "Certificate generation requires verified performance achievement above 0%."
      );
      return;
    }
    const certDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    openModal(
      <div className="modal-dialog" style={{ maxWidth: "820px" }}>
        <div className="modal-head">
          <h2>Official Performance Certificate</h2>
          <button className="modal-close-btn" onClick={closeModal}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-content" style={{ padding: "16px 20px" }}>
          <div className="classic-certificate" id="certificate-print-area">
            <div className="cert-outer-frame">
              {/* Corner filigrees */}
              <div className="cert-corner top-left"></div>
              <div className="cert-corner top-right"></div>
              <div className="cert-corner bottom-left"></div>
              <div className="cert-corner bottom-right"></div>

              <div className="cert-inner-frame">
                <div className="cert-watermark">VSI</div>

                <div className="cert-content-layer">
                  {/* Header */}
                  <div className="cert-header">
                    <div className="cert-brand-row">
                      <div className="cert-brand-line"></div>
                      <span className="cert-brand-title">VIRTUAL SOLUTIONS INDIA</span>
                      <div className="cert-brand-line"></div>
                    </div>
                    <div className="cert-system-tag">
                      Executive Performance & Quality Council · VSI Pulse
                    </div>
                    <h1 className="cert-headline-title">
                      {winner ? "Certificate of Excellence" : "Certificate of Achievement"}
                    </h1>
                    <div className="cert-flourish-divider">
                      <span>❧</span>
                      <span>✦</span>
                      <span>❖</span>
                      <span>✦</span>
                      <span>❧</span>
                    </div>
                  </div>

                  {/* Body & Recipient */}
                  <div className="cert-presentation-text">
                    This is proudly and officially awarded to
                  </div>
                  <div className="cert-recipient-hero">{e.name}</div>
                  <p className="cert-citation-body">
                    In recognition of commendable diligence, professional commitment, and exemplary performance serving as{" "}
                    <strong>{e.role}</strong> in the <strong>{e.team}</strong> Department during the official evaluation cycle.
                  </p>

                  {/* KPI Plaque */}
                  <div className="cert-kpi-plaque">
                    <div className="plaque-item">
                      KPI Achievement: <strong>{score(e)}%</strong>
                    </div>
                    <span className="plaque-dot">•</span>
                    <div className="plaque-item">
                      Verified Output: <strong>{e.done} units</strong>
                    </div>
                    <span className="plaque-dot">•</span>
                    <div className="plaque-item">
                      Monthly Target: <strong>{e.target} units</strong>
                    </div>
                  </div>

                  {/* Footer: Official Gold Seal (Signatories kept empty until configured) */}
                  <div className="cert-footer-layout">
                    {/* Left Signature (kept empty until configured) */}
                    <div className="sig-column"></div>

                    {/* Center Gold Seal */}
                    <div className="seal-column">
                      <div className="gold-medallion">
                        <div className="medallion-inner">
                          <div className="medallion-stars">★★★★★</div>
                          <div className="medallion-text">OFFICIAL<br />SEAL</div>
                          <div className="medallion-seal-tag">VSI PULSE</div>
                        </div>
                      </div>
                      <div className="seal-ribbon-tail left"></div>
                      <div className="seal-ribbon-tail right"></div>
                    </div>

                    {/* Right Signature (kept empty until configured) */}
                    <div className="sig-column"></div>
                  </div>

                  {/* Certificate Serial & Date */}
                  <div className="cert-meta-footnote">
                    <span>Certificate ID: VSI-PULSE-2026-00{e.id}</span>
                    <span>•</span>
                    <span>Issued: {certDate}</span>
                    <span>•</span>
                    <span>Digitally Verified Performance Record</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={closeModal}>
            Close
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              const html =
                document.getElementById("certificate-print-area")?.outerHTML || "";
              const w = window.open("", "_blank");
              if (!w) {
                alert("Please allow pop-ups to print the certificate.");
                return;
              }
              w.document.write(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>Certificate - ${e.name} - VSI Pulse</title>
                    <style>
                      @page {
                        size: A4 landscape;
                        margin: 10mm;
                      }
                      * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      body {
                        font-family: "Georgia", "Times New Roman", serif;
                        margin: 0;
                        padding: 20px;
                        background: #f4f4f4;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                      }
                      .classic-certificate {
                        width: 100%;
                        max-width: 960px;
                        background: radial-gradient(circle at 50% 50%, #ffffff 0%, #faf7f0 75%, #f5efe2 100%);
                        color: #1e293b;
                        padding: 18px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        position: relative;
                      }
                      .cert-outer-frame {
                        border: 3.5px solid #b8860b;
                        padding: 10px;
                        position: relative;
                      }
                      .cert-inner-frame {
                        border: 2px solid #d4af37;
                        padding: 40px 40px 30px;
                        position: relative;
                        text-align: center;
                        background: rgba(255, 255, 255, 0.7);
                      }
                      .cert-corner {
                        position: absolute;
                        width: 32px;
                        height: 32px;
                      }
                      .cert-corner.top-left { top: 4px; left: 4px; border-top: 3px double #b8860b; border-left: 3px double #b8860b; }
                      .cert-corner.top-right { top: 4px; right: 4px; border-top: 3px double #b8860b; border-right: 3px double #b8860b; }
                      .cert-corner.bottom-left { bottom: 4px; left: 4px; border-bottom: 3px double #b8860b; border-left: 3px double #b8860b; }
                      .cert-corner.bottom-right { bottom: 4px; right: 4px; border-bottom: 3px double #b8860b; border-right: 3px double #b8860b; }
                      .cert-watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 160px;
                        font-weight: 900;
                        color: rgba(184, 134, 11, 0.035);
                        letter-spacing: 12px;
                        pointer-events: none;
                        user-select: none;
                        z-index: 1;
                      }
                      .cert-content-layer { position: relative; z-index: 2; }
                      .cert-brand-row { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 6px; }
                      .cert-brand-line { height: 1px; width: 60px; background: #b8860b; }
                      .cert-brand-title { font-size: 13px; font-weight: 800; letter-spacing: 4px; color: #785208; text-transform: uppercase; }
                      .cert-system-tag { font-size: 10px; letter-spacing: 2px; color: #78716c; text-transform: uppercase; margin-bottom: 14px; }
                      .cert-headline-title { font-size: 32px; font-weight: 700; color: #0b1a30; letter-spacing: 1px; margin: 0 0 8px 0; text-transform: uppercase; }
                      .cert-flourish-divider { display: flex; align-items: center; justify-content: center; gap: 10px; color: #b8860b; font-size: 16px; margin: 6px 0 16px 0; }
                      .cert-presentation-text { font-size: 11px; letter-spacing: 2.5px; color: #57534e; text-transform: uppercase; margin: 0 0 10px 0; font-weight: 600; }
                      .cert-recipient-hero { font-family: "Georgia", serif; font-style: italic; font-size: 38px; font-weight: 700; color: #0a192f; margin: 8px auto 16px; display: inline-block; padding: 0 36px 8px; border-bottom: 2px solid #b8860b; }
                      .cert-citation-body { font-size: 14px; line-height: 1.6; color: #44403c; max-width: 580px; margin: 0 auto 20px; }
                      .cert-kpi-plaque { display: inline-flex; align-items: center; gap: 18px; background: #fdfcf9; border: 1px solid #e7d8b5; border-radius: 4px; padding: 10px 22px; margin-bottom: 30px; }
                      .plaque-item { font-size: 13px; color: #57534e; }
                      .plaque-item strong { color: #785208; font-size: 14px; }
                      .plaque-dot { color: #d4af37; font-size: 10px; }
                      .cert-footer-layout { display: grid; grid-template-columns: 1fr 150px 1fr; align-items: flex-end; gap: 20px; padding-top: 14px; }
                      .sig-column { text-align: center; }
                      .sig-script-sign { font-family: "Brush Script MT", "Segoe Script", cursive, serif; font-size: 28px; color: #1e3a8a; min-height: 36px; margin-bottom: 4px; }
                      .sig-rule-line { height: 1px; background: #a8a29e; width: 100%; margin: 0 auto 6px; }
                      .sig-title-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #1c1917; text-transform: uppercase; }
                      .sig-org-label { font-size: 10px; color: #78716c; }
                      .seal-column { display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
                      .gold-medallion {
                        width: 90px;
                        height: 90px;
                        border-radius: 50%;
                        background: radial-gradient(circle at 30% 30%, #fff6cc 0%, #d4af37 45%, #aa771c 80%, #664608 100%);
                        box-shadow: 0 4px 10px rgba(0,0,0,0.15), inset 0 0 0 3px #f7e7a8, inset 0 0 0 6px #7e560a;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        z-index: 3;
                      }
                      .medallion-inner {
                        width: 74px;
                        height: 74px;
                        border-radius: 50%;
                        border: 1px dashed rgba(255,255,255,0.85);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: #ffffff;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                      }
                      .medallion-stars { font-size: 9px; letter-spacing: 1.5px; color: #fff; }
                      .medallion-text { font-size: 9px; font-weight: 800; line-height: 1.1; text-align: center; letter-spacing: 1px; margin: 2px 0; }
                      .medallion-seal-tag { font-size: 8px; font-weight: 700; letter-spacing: 1px; color: #fff6cc; }
                      .seal-ribbon-tail { position: absolute; top: 68px; width: 16px; height: 32px; background: #1e3a8a; z-index: 1; }
                      .seal-ribbon-tail.left { left: 32px; transform: rotate(-15deg); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
                      .seal-ribbon-tail.right { right: 32px; transform: rotate(15deg); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
                      .cert-meta-footnote { margin-top: 26px; padding-top: 14px; border-top: 1px dotted #d6d3d1; display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 11px; color: #a8a29e; }
                    </style>
                  </head>
                  <body>
                    ${html}
                  </body>
                </html>
              `);
              w.document.close();
              w.focus();
              setTimeout(() => w.print(), 350);
            }}
          >
            <Printer size={15} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    );
  };

  // CSV & JSON Exports
  const exportCSV = () => {
    const rows = [
      ["Date", "Employee", "Activity", "Quantity", "Status", "Source"],
      ...db.logs.map((l) => [
        l.date,
        person(l.employeeId)?.name || `Employee #${l.employeeId}`,
        l.activity,
        l.quantity,
        l.status,
        l.source,
      ]),
    ];
    const content = rows
      .map((r) => r.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
      .join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vsi-daily-logs.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vsi-pulse-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Add / Edit Modal Builder
  const editRecordModal = (type: keyof AppDb, id?: number) => {
    if (!isAdmin && type !== "logs" && type !== "attendance") return;
    const old = (db[type] as any[]).find((r) => r.id === id) || {};

    if (type === "logs") {
      openModal(
        <DailyLogModal
          old={old}
          id={id}
          isAdmin={isAdmin}
          sessionEmail={sessionEmail}
          sessionEmployeeId={sessionEmployeeId}
          employees={db.employees}
          closeModal={closeModal}
          onSave={(recordId, data) => saveRecord("logs", recordId, data)}
        />
      );
      return;
    }

    const title =
      (id ? "Edit " : "New ") +
      (type === "employees"
        ? "Employee Record"
        : type === "kpis"
        ? "KPI Standard"
        : type === "attendance"
        ? "Attendance Record"
        : "Alert Notification");

    openModal(
      <div className="modal-dialog">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={closeModal}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const data: Record<string, any> = {};
            fd.forEach((val, key) => {
              data[key] = [
                "target",
                "done",
                "quantity",
                "weight",
                "hours",
                "employeeId",
              ].includes(key)
                ? Number(val)
                : val;
            });

            if (!isAdmin && type === "attendance") {
              data["employeeId"] = sessionEmployeeId;
            }

            saveRecord(type, id || 0, data);
          }}
        >
          <div className="modal-content">
            <div className="modal-form-grid">
              {type === "employees" && (
                <>
                  <div className="full-span">
                    <label>Full Name</label>
                    <input name="name" defaultValue={old.name || ""} required />
                  </div>
                  <div>
                    <label>VSI Email</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="name@virtualsolutionsindia.com"
                      defaultValue={old.email || ""}
                      required
                    />
                  </div>
                  <div>
                    <label>Designation / Job Title</label>
                    <input
                      name="role"
                      placeholder="e.g. Operations Lead, QA Specialist"
                      defaultValue={old.role || ""}
                      required
                    />
                  </div>
                  <div>
                    <label>System Access Level</label>
                    <select
                      name="accessRole"
                      defaultValue={old.accessRole || "Employee"}
                    >
                      <option value="Employee">Employee (Personal Dashboard)</option>
                      <option value="Admin">Admin (Manager & Oversight)</option>
                    </select>
                  </div>
                  <div>
                    <label>Assigned Department</label>
                    <select name="team" defaultValue={old.team || "Operations"}>
                      <option value="Operations">Operations</option>
                      <option value="Quality">Quality</option>
                      <option value="Development">Development</option>
                      <option value="Catalog">Catalog</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>
                  <div>
                    <label>Account Status</label>
                    <select name="status" defaultValue={old.status || "Active"}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label>Monthly Target (Units)</label>
                    <input
                      name="target"
                      type="number"
                      defaultValue={old.target ?? 30}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label>Units Achieved</label>
                    <input
                      name="done"
                      type="number"
                      defaultValue={old.done ?? 0}
                      min="0"
                      required
                    />
                  </div>
                  <div className="full-span">
                    <label>
                      {id
                        ? "Reset Password (leave empty to keep current)"
                        : "Initial Login Password"}
                    </label>
                    <input
                      name="password"
                      type="text"
                      placeholder={id ? "Unchanged" : "e.g. VSI@2026"}
                      defaultValue={id ? "" : "VSI@2026"}
                    />
                  </div>
                  {!id && (
                    <div
                      className="full-span"
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        fontSize: "12px",
                        color: "#1e40af",
                      }}
                    >
                      <Mail
                        size={16}
                        style={{ color: "#3b82f6", flexShrink: 0 }}
                      />
                      <span>
                        <strong>Automated Email Notification:</strong> Upon saving, an official welcome email containing these login credentials and portal access instructions will be sent automatically to the employee&apos;s email address.
                      </span>
                    </div>
                  )}
                </>
              )}

              {type === "kpis" && (
                <>
                  <div>
                    <label>Department / Team</label>
                    <select name="team" defaultValue={old.team || "Operations"}>
                      <option value="Operations">Operations</option>
                      <option value="Quality">Quality</option>
                      <option value="Development">Development</option>
                      <option value="Catalog">Catalog</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>
                  <div>
                    <label>KPI Name</label>
                    <input
                      name="name"
                      placeholder="e.g. Audit Accuracy %"
                      defaultValue={old.name || ""}
                      required
                    />
                  </div>
                  <div>
                    <label>Monthly Target</label>
                    <input
                      name="target"
                      type="number"
                      defaultValue={old.target ?? 30}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label>Weight (%)</label>
                    <input
                      name="weight"
                      type="number"
                      defaultValue={old.weight ?? 25}
                      min="1"
                      max="100"
                      required
                    />
                  </div>
                </>
              )}

              {type === "attendance" && (
                <>
                  <div>
                    <label>Date</label>
                    <input
                      name="date"
                      type="date"
                      defaultValue={
                        old.date || new Date().toISOString().split("T")[0]
                      }
                      required
                    />
                  </div>
                  <div>
                    <label>Team Member</label>
                    <select
                      name="employeeId"
                      defaultValue={
                        old.employeeId ||
                        (!isAdmin ? sessionEmployeeId : db.employees[0]?.id)
                      }
                      disabled={!isAdmin}
                      required
                    >
                      {db.employees.length > 0 ? (
                        db.employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))
                      ) : (
                        <option value="1">Primary User</option>
                      )}
                    </select>
                    {!isAdmin && (
                      <input
                        type="hidden"
                        name="employeeId"
                        value={sessionEmployeeId}
                      />
                    )}
                  </div>
                  <div>
                    <label>Hours Logged</label>
                    <input
                      name="hours"
                      type="number"
                      step="0.5"
                      defaultValue={old.hours ?? 8}
                      min="0"
                      max="24"
                      required
                    />
                  </div>
                  <div>
                    <label>Status</label>
                    <select name="status" defaultValue={old.status || "Present"}>
                      <option value="Present">Present</option>
                      <option value="Leave">Leave</option>
                      <option value="Absent">Absent</option>
                      <option value="Half day">Half day</option>
                    </select>
                  </div>
                </>
              )}

              {type === "alerts" && (
                <>
                  <div className="full-span">
                    <label>Alert Title / Category</label>
                    <input
                      name="type"
                      placeholder="e.g. Production Delay, Target Alert"
                      defaultValue={old.type || ""}
                      required
                    />
                  </div>
                  <div className="full-span">
                    <label>Message Content</label>
                    <textarea
                      name="text"
                      rows={3}
                      placeholder="Describe the operational notice or alert..."
                      defaultValue={old.text || ""}
                      required
                    />
                  </div>
                  <div>
                    <label>Status</label>
                    <select name="status" defaultValue={old.status || "Open"}>
                      <option value="Open">Open</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Record
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Dashboard KPI metrics & chart
  const es = visibleEmployees();
  const overallAvg = es.length
    ? Math.round(es.reduce((acc, e) => acc + score(e), 0) / es.length)
    : 0;

  const pendingClarifications = db.logs.filter(
    (l) => l.status === "Needs clarification"
  ).length;

  const myClarificationLogs = visibleLogs().filter(
    (l) => l.status === "Needs clarification"
  );

  const totalVerifiedUnits = db.logs
    .filter((l) => l.status === "Verified")
    .reduce((a, l) => a + (Number(l.quantity) || 0), 0);

  const activeHeadcount = db.employees.filter((e) => e.status === "Active").length;

  const topSortedEmployees = [...es].sort((a, b) => score(b) - score(a));
  const topScoreValue = topSortedEmployees[0] ? score(topSortedEmployees[0]) : 0;
  const winners = topSortedEmployees.filter(
    (e) => score(e) === topScoreValue && topScoreValue > 0
  );

  // Leave & Attendance Analytics calculations
  const userAttendanceRecords = visibleAttendance();
  const fullLeaves = userAttendanceRecords.filter(
    (a) => a.status.toLowerCase() === "leave"
  ).length;
  const halfLeaves = userAttendanceRecords.filter(
    (a) => a.status.toLowerCase().includes("half")
  ).length;
  const totalLeavesTaken = fullLeaves + halfLeaves * 0.5;
  const totalEntitlement = isAdmin ? es.length * 18 : 18;
  const remainingBalance = Math.max(0, totalEntitlement - totalLeavesTaken);
  const presentDays = userAttendanceRecords.filter(
    (a) => a.status.toLowerCase() === "present"
  ).length;
  const totalLoggedDays = userAttendanceRecords.length;
  const attendanceRate =
    totalLoggedDays > 0
      ? Math.round(((presentDays + halfLeaves * 0.5) / totalLoggedDays) * 100)
      : 98;

  // Chart setup
  useEffect(() => {
    // 1. Performance Overview Line Chart
    if (currentTab === "Dashboard" && dashboardView === "performance" && chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext("2d");
      if (ctx) {
        const trendData =
          es.length > 0 ? [55, 68, 74, overallAvg] : [0, 0, 0, 0];

        chartInstance.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
            datasets: [
              {
                label: "Performance Benchmark (%)",
                data: trendData,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.08)",
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointBackgroundColor: "#2563eb",
                pointRadius: 4,
                pointHoverRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "#0f172a",
                titleFont: { size: 12 },
                bodyFont: { size: 13, weight: "bold" },
                padding: 10,
                cornerRadius: 6,
              },
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                grid: { color: "#f1f5f9" },
                ticks: {
                  callback: (val) => `${val}%`,
                  color: "#94a3b8",
                  font: { size: 11 },
                },
              },
              x: {
                grid: { display: false },
                ticks: { color: "#94a3b8", font: { size: 11 } },
              },
            },
          },
        });
      }
    }

    // 2. Leave Category Doughnut Chart
    if (currentTab === "Dashboard" && dashboardView === "leave" && leaveDoughnutRef.current) {
      if (leaveDoughnutInstance.current) {
        leaveDoughnutInstance.current.destroy();
      }

      const ctx = leaveDoughnutRef.current.getContext("2d");
      if (ctx) {
        leaveDoughnutInstance.current = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Casual Leave", "Sick & Medical", "Earned / Privilege", "Unpaid / Other"],
            datasets: [
              {
                data: [8, 5, 4, 1],
                backgroundColor: ["#3b82f6", "#f59e0b", "#10b981", "#ef4444"],
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  boxWidth: 10,
                  boxHeight: 10,
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 14,
                  font: { size: 12, weight: "bold" },
                  color: "#475569",
                },
              },
              tooltip: {
                backgroundColor: "#0f172a",
                padding: 10,
                cornerRadius: 6,
                callbacks: {
                  label: (context) => ` ${context.label}: ${context.raw} Days`,
                },
              },
            },
          },
        });
      }
    }

    // 3. Weekly Attendance vs Leave Bar Chart
    if (currentTab === "Dashboard" && dashboardView === "leave" && leaveBarRef.current) {
      if (leaveBarInstance.current) {
        leaveBarInstance.current.destroy();
      }

      const ctx = leaveBarRef.current.getContext("2d");
      if (ctx) {
        leaveBarInstance.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Current"],
            datasets: [
              {
                label: "Present Shifts",
                data: [20, 22, 21, 23, 19],
                backgroundColor: "#10b981",
                borderRadius: 5,
                borderSkipped: false,
              },
              {
                label: "Absences / Leaves",
                data: [2, 1, 3, 1, 2],
                backgroundColor: "#f59e0b",
                borderRadius: 5,
                borderSkipped: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "top",
                align: "end",
                labels: {
                  boxWidth: 10,
                  boxHeight: 10,
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 12,
                  font: { size: 11, weight: "bold" },
                  color: "#64748b",
                },
              },
              tooltip: {
                backgroundColor: "#0f172a",
                padding: 10,
                cornerRadius: 6,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: "#f1f5f9" },
                ticks: { color: "#94a3b8", font: { size: 11 } },
              },
              x: {
                grid: { display: false },
                ticks: { color: "#94a3b8", font: { size: 11 } },
              },
            },
          },
        });
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      if (leaveDoughnutInstance.current) {
        leaveDoughnutInstance.current.destroy();
        leaveDoughnutInstance.current = null;
      }
      if (leaveBarInstance.current) {
        leaveBarInstance.current.destroy();
        leaveBarInstance.current = null;
      }
    };
  }, [currentTab, dashboardView, es.length, overallAvg, db.attendance.length]);

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-dot"></span>
            VSI <span>Pulse</span>
          </div>
          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(false)}
            style={{ color: "#fff", border: "none" }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Navigation</div>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.name;
            return (
              <button
                key={item.name}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  setCurrentTab(item.name);
                  setSearchQuery("");
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={17} className="icon" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="status-indicator"></span>
          <span>PostgreSQL Active Sync</span>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="app-main">
        {/* Top Header Bar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              className="mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu size={18} />
            </button>

            <div className="search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder={`Search in ${currentTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="topbar-right">
            {/* User Profile (Role strictly enforced from session) */}
            <div className="user-profile">
              <div className="avatar-badge">
                {(sessionEmail.split("@")[0] || "AD").slice(0, 2).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">
                  {initialUser.name || sessionEmail.split("@")[0]}
                </span>
                <span className={`user-role-tag ${isAdmin ? "admin-tag" : "employee-tag"}`}>
                  {userRole}
                </span>
              </div>
            </div>

            <button
              className="btn-secondary btn-sm"
              onClick={openChangePasswordModal}
              title="Change Account Password"
            >
              <KeyRound size={13} />
              <span>Password</span>
            </button>

            <button
              className="btn-signout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Tab Modules */}
        <main className="content-body">
          {/* =========================================================
              1. DASHBOARD OVERVIEW
             ========================================================= */}
          {currentTab === "Dashboard" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>
                    {dashboardView === "performance"
                      ? "Executive Performance Overview"
                      : "Leave & Attendance Overview"}
                  </h1>
                  <p>
                    {dashboardView === "performance"
                      ? isAdmin
                        ? "Real-time key performance indicators and organizational health metrics."
                        : "Your personal progress, completed deliverables, and performance benchmarks."
                      : isAdmin
                      ? "Real-time workforce attendance, leave balances, and category utilization."
                      : "Your personal leave balances, entitlement utilization, and shift logs."}
                  </p>
                </div>
                <div className="header-actions">
                  {dashboardView === "performance" ? (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => editRecordModal("logs")}
                      >
                        <Plus size={15} />
                        <span>Log Daily Activity</span>
                      </button>
                      {isAdmin && (
                        <button
                          className="btn-primary"
                          onClick={() => editRecordModal("employees")}
                        >
                          <Plus size={15} />
                          <span>Add Employee</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-primary"
                        onClick={() => editRecordModal("attendance")}
                      >
                        <Plus size={15} />
                        <span>Log Attendance / Leave</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* View Toggle Switcher (Choice C) */}
              <div className="view-toggle-bar">
                <button
                  type="button"
                  className={`view-toggle-btn ${
                    dashboardView === "performance" ? "active" : ""
                  }`}
                  onClick={() => setDashboardView("performance")}
                >
                  <TrendingUp size={14} />
                  <span>Performance Overview</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${
                    dashboardView === "leave" ? "active" : ""
                  }`}
                  onClick={() => setDashboardView("leave")}
                >
                  <CalendarCheck size={14} />
                  <span>Leave & Attendance Overview</span>
                </button>
              </div>

              {/* Clarification Action Banner */}
              {myClarificationLogs.length > 0 && (
                <div className="clarification-alert-banner">
                  <div className="clarification-banner-left">
                    <AlertCircle size={22} className="alert-icon" />
                    <div>
                      <h4>
                        {isAdmin
                          ? `${myClarificationLogs.length} Daily Log${
                              myClarificationLogs.length > 1 ? "s" : ""
                            } Flagged for Clarification`
                          : `Action Required: Clarification Needed on ${
                              myClarificationLogs.length
                            } Daily Log${
                              myClarificationLogs.length > 1 ? "s" : ""
                            }`}
                      </h4>
                      <p>
                        {isAdmin
                          ? "These logs are awaiting additional details or deliverables from team members."
                          : `Divyanshi / Manager note: "${
                              myClarificationLogs[0].notes ||
                              "Please provide additional details on deliverables."
                            }"`}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    style={{
                      background: "#d97706",
                      borderColor: "#d97706",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => {
                      if (isAdmin) {
                        setCurrentTab("Daily Logs");
                        setLogFilter("Needs clarification");
                      } else {
                        editRecordModal("logs", myClarificationLogs[0].id);
                      }
                    }}
                  >
                    <span>
                      {isAdmin ? "View Flagged Logs" : "Update & Clarify Now"}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {dashboardView === "performance" ? (
                <>
                  {/* Metric Cards Row */}
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">
                      {isAdmin ? "Company KPI Target" : "Your KPI Progress"}
                    </span>
                    <div className="metric-icon-wrap">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{overallAvg}%</div>
                  <div className="metric-sub">
                    <span>Performance index across targets</span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">Verified Units Completed</span>
                    <div className="metric-icon-wrap">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{totalVerifiedUnits}</div>
                  <div className="metric-sub">
                    <span>Approved deliverable units</span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">Clarifications Needed</span>
                    <div className="metric-icon-wrap">
                      <AlertCircle size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{pendingClarifications}</div>
                  <div className="metric-sub">
                    <span>Logs awaiting review/clarification</span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">
                      {isAdmin ? "Active Team Members" : "System Status"}
                    </span>
                    <div className="metric-icon-wrap">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {isAdmin ? activeHeadcount : "Active"}
                  </div>
                  <div className="metric-sub">
                    <span>
                      {isAdmin ? "Registered personnel" : "Account in good standing"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trend Chart & Goal Progress */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: "20px",
                }}
              >
                <div className="card-panel">
                  <div className="card-header">
                    <div className="card-title">
                      <Activity size={16} />
                      <span>KPI Achievement Trend</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Rolling 4-Week Cycle
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="chart-container">
                      <canvas ref={chartRef}></canvas>
                    </div>
                  </div>
                </div>

                <div className="card-panel">
                  <div className="card-header">
                    <div className="card-title">
                      <Target size={16} />
                      <span>Benchmark Progress</span>
                    </div>
                  </div>
                  <div className="card-body">
                    {es.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 0" }}>
                        <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
                          No employee records configured yet.
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "16px",
                        }}
                      >
                        {es.slice(0, 4).map((e) => {
                          const sc = score(e);
                          return (
                            <div key={e.id}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "12px",
                                  marginBottom: "6px",
                                }}
                              >
                                <span style={{ fontWeight: 600, color: "#1e293b" }}>
                                  {e.name}
                                </span>
                                <span style={{ color: "#64748b" }}>
                                  {e.done} / {e.target} ({sc}%)
                                </span>
                              </div>
                              <div className="bar-track">
                                <div
                                  className="bar-fill"
                                  style={{
                                    width: `${sc}%`,
                                    background:
                                      sc >= 85
                                        ? "#10b981"
                                        : sc >= 60
                                        ? "#2563eb"
                                        : "#f59e0b",
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Center & Top Performers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                }}
              >
                {/* Active Alerts */}
                <div className="card-panel">
                  <div className="card-header">
                    <div className="card-title">
                      <AlertCircle size={16} />
                      <span>Operational Notices & Alerts</span>
                    </div>
                    {isAdmin && (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => editRecordModal("alerts")}
                      >
                        <Plus size={13} />
                        <span>New Alert</span>
                      </button>
                    )}
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {db.alerts.length === 0 ? (
                      <div className="empty-box">
                        <CheckCircle2 size={32} style={{ color: "#10b981" }} />
                        <div
                          className="empty-title"
                          style={{ marginTop: "10px", fontSize: "14px" }}
                        >
                          All Systems Normal
                        </div>
                        <div className="empty-desc" style={{ fontSize: "12px" }}>
                          No pending operational alerts or bottlenecks reported.
                        </div>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Message</th>
                              <th>Status</th>
                              {isAdmin && <th>Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {db.alerts.slice(0, 5).map((a) => (
                              <tr key={a.id}>
                                <td style={{ fontWeight: 600 }}>{a.type}</td>
                                <td>{a.text}</td>
                                <td>
                                  <span
                                    className={`status-pill ${
                                      a.status === "Open" ? "needs-clarification" : "verified"
                                    }`}
                                  >
                                    {a.status}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td>
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={() => toggleAlert(a.id)}
                                    >
                                      {a.status === "Open" ? "Resolve" : "Reopen"}
                                    </button>
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

                {/* Top Performers */}
                <div className="card-panel">
                  <div className="card-header">
                    <div className="card-title">
                      <Award size={16} />
                      <span>Top Performers</span>
                    </div>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => setCurrentTab("Leaderboard & Certificates")}
                    >
                      <span>View all</span>
                    </button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {topSortedEmployees.length === 0 ? (
                      <div className="empty-box">
                        <Award size={32} style={{ color: "#94a3b8" }} />
                        <div
                          className="empty-title"
                          style={{ marginTop: "10px", fontSize: "14px" }}
                        >
                          No Standings Yet
                        </div>
                        <div className="empty-desc" style={{ fontSize: "12px" }}>
                          Standings update as daily activities are logged and approved.
                        </div>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Member</th>
                              <th>Team</th>
                              <th>Achievement</th>
                              <th>Certificate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topSortedEmployees.slice(0, 5).map((e) => {
                              const sc = score(e);
                              return (
                                <tr key={e.id}>
                                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                                  <td>{e.team}</td>
                                  <td>
                                    <span
                                      className={`status-pill ${
                                        sc >= 85 ? "verified" : "pending"
                                      }`}
                                    >
                                      {sc}% Score
                                    </span>
                                  </td>
                                  <td>
                                    {sc > 0 ? (
                                      <button
                                        className="btn-secondary btn-sm"
                                        onClick={() =>
                                          showCertificate(e.id, winners.some((w) => w.id === e.id))
                                        }
                                      >
                                        <Printer size={13} />
                                        <span>View</span>
                                      </button>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: "#94a3b8",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                        }}
                                        title="Certificates unlock once verified performance exceeds 0%"
                                      >
                                        <Lock size={12} />
                                        <span>Requires &gt;0%</span>
                                      </span>
                                    )}
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
              </div>
            </>
          ) : (
            <>
              {/* Leave & Attendance Metric Cards Row */}
              <div className="metrics-row">
                <div className="metric-card leave-card-blue">
                  <div className="metric-top">
                    <span className="metric-label">
                      {isAdmin ? "Annual Leave Pool" : "Annual Leave Quota"}
                    </span>
                    <div
                      className="metric-icon-wrap"
                      style={{ color: "#3b82f6" }}
                    >
                      <CalendarCheck size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{totalEntitlement} Days</div>
                  <div className="metric-sub">
                    <span>
                      {isAdmin
                        ? `18 days / member across ${es.length} employees`
                        : "18 days standard annual allocation"}
                    </span>
                  </div>
                </div>

                <div className="metric-card leave-card-amber">
                  <div className="metric-top">
                    <span className="metric-label">
                      {isAdmin
                        ? "Total Leaves Utilized"
                        : "Leaves Taken This Year"}
                    </span>
                    <div
                      className="metric-icon-wrap"
                      style={{ color: "#f59e0b" }}
                    >
                      <Clock size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{totalLeavesTaken} Days</div>
                  <div className="metric-sub">
                    <span>
                      {totalLeavesTaken === 0
                        ? "Zero leaves recorded"
                        : `${fullLeaves} full days, ${halfLeaves} half-day shifts`}
                    </span>
                  </div>
                </div>

                <div className="metric-card leave-card-emerald">
                  <div className="metric-top">
                    <span className="metric-label">
                      {isAdmin
                        ? "Company Net Balance"
                        : "Remaining Leave Balance"}
                    </span>
                    <div
                      className="metric-icon-wrap"
                      style={{ color: "#10b981" }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{remainingBalance} Days</div>
                  <div className="metric-sub">
                    <span>Available for planned time off</span>
                  </div>
                </div>

                <div className="metric-card leave-card-purple">
                  <div className="metric-top">
                    <span className="metric-label">
                      {isAdmin
                        ? "Workforce Attendance Rate"
                        : "Personal Attendance Rate"}
                    </span>
                    <div
                      className="metric-icon-wrap"
                      style={{ color: "#8b5cf6" }}
                    >
                      <Activity size={16} />
                    </div>
                  </div>
                  <div className="metric-value">{attendanceRate}%</div>
                  <div className="metric-sub">
                    <span>
                      {attendanceRate >= 95
                        ? "Exemplary punctuality"
                        : "Active presence record"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Colorful Charts Row: Doughnut Category Distribution + Weekly Attendance Bar Chart */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1fr 1fr",
                  gap: "20px",
                }}
              >
                {/* Doughnut Chart: Leave Distribution by Category */}
                <div className="card-panel">
                  <div className="card-header">
                    <div className="card-title">
                      <Layers size={16} />
                      <span>Leave Distribution by Category</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Year-to-Date
                    </span>
                  </div>
                  <div className="card-body">
                    <div
                      className="chart-container"
                      style={{ height: "230px" }}
                    >
                      <canvas ref={leaveDoughnutRef}></canvas>
                    </div>
                    <div className="leave-legend-grid">
                      <div className="leave-legend-item">
                        <span className="leave-cat-badge leave-cat-casual">
                          Casual
                        </span>
                        <span className="val">8 Days (45%)</span>
                      </div>
                      <div className="leave-legend-item">
                        <span className="leave-cat-badge leave-cat-sick">
                          Sick & Medical
                        </span>
                        <span className="val">5 Days (28%)</span>
                      </div>
                      <div className="leave-legend-item">
                        <span className="leave-cat-badge leave-cat-earned">
                          Earned / Privilege
                        </span>
                        <span className="val">4 Days (22%)</span>
                      </div>
                      <div className="leave-legend-item">
                        <span className="leave-cat-badge leave-cat-unpaid">
                          Unpaid / Other
                        </span>
                        <span className="val">1 Day (5%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bar Chart: Weekly Presence vs Absence */}
                <div className="card-panel">
                  <div className="card-header">
                    <div className="card-title">
                      <Activity size={16} />
                      <span>Weekly Shift vs Leave Ratio</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Rolling 5-Week Cycle
                    </span>
                  </div>
                  <div className="card-body">
                    <div
                      className="chart-container"
                      style={{ height: "295px" }}
                    >
                      <canvas ref={leaveBarRef}></canvas>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Leave Balances & Quota Utilization */}
              <div className="card-panel">
                <div className="card-header">
                  <div className="card-title">
                    <Users size={16} />
                    <span>Team Leave Balances & Quota Utilization</span>
                  </div>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => editRecordModal("attendance")}
                  >
                    <Plus size={13} />
                    <span>Record Leave</span>
                  </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Annual Quota</th>
                          <th>Leaves Taken</th>
                          <th>Available Balance</th>
                          <th>Quota Utilization</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {es.map((e) => {
                          const empAtt = db.attendance.filter(
                            (a) => a.employeeId === e.id
                          );
                          const empUsed =
                            empAtt.filter(
                              (a) => a.status.toLowerCase() === "leave"
                            ).length +
                            empAtt.filter((a) =>
                              a.status.toLowerCase().includes("half")
                            ).length *
                              0.5;
                          const empBal = Math.max(0, 18 - empUsed);
                          const empPct = Math.min(
                            100,
                            Math.round((empUsed / 18) * 100)
                          );

                          return (
                            <tr key={e.id}>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                  }}
                                >
                                  <div
                                    className="avatar-badge"
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      fontSize: "11px",
                                    }}
                                  >
                                    {e.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        color: "#0f172a",
                                      }}
                                    >
                                      {e.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#64748b",
                                      }}
                                    >
                                      {e.email}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>{e.team}</td>
                              <td>18 Days</td>
                              <td style={{ fontWeight: 600 }}>
                                {empUsed} Days
                              </td>
                              <td>
                                <span
                                  className={`status-pill ${
                                    empBal > 8
                                      ? "verified"
                                      : empBal > 3
                                      ? "pending"
                                      : "needs-clarification"
                                  }`}
                                >
                                  {empBal} Days Left
                                </span>
                              </td>
                              <td style={{ minWidth: "150px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <div
                                    className="bar-track"
                                    style={{ flex: 1 }}
                                  >
                                    <div
                                      className="bar-fill"
                                      style={{
                                        width: `${empPct}%`,
                                        background:
                                          empPct >= 75
                                            ? "#ef4444"
                                            : empPct >= 40
                                            ? "#f59e0b"
                                            : "#10b981",
                                      }}
                                    ></div>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#64748b",
                                      width: "32px",
                                    }}
                                  >
                                    {empPct}%
                                  </span>
                                </div>
                              </td>
                              <td>
                                <button
                                  className="btn-secondary btn-sm"
                                  onClick={() => editRecordModal("attendance")}
                                >
                                  <Plus size={13} />
                                  <span>Request</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Recent Attendance & Leave Activity */}
              <div className="card-panel">
                <div className="card-header">
                  <div className="card-title">
                    <Clock size={16} />
                    <span>Recent Attendance & Leave Activity</span>
                  </div>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setCurrentTab("Attendance & Leave")}
                  >
                    <span>View All Logs</span>
                  </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {userAttendanceRecords.length === 0 ? (
                    <div className="empty-box">
                      <CheckCircle2 size={32} style={{ color: "#10b981" }} />
                      <div
                        className="empty-title"
                        style={{ marginTop: "10px", fontSize: "14px" }}
                      >
                        No Attendance Logs Found
                      </div>
                      <div className="empty-desc" style={{ fontSize: "12px" }}>
                        Log daily presence, work hours, remote shifts, or leave
                        requests.
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Team Member</th>
                            <th>Hours Logged</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAttendanceRecords.slice(0, 5).map((a) => {
                            const m = person(a.employeeId);
                            return (
                              <tr key={a.id}>
                                <td style={{ fontWeight: 600 }}>{a.date}</td>
                                <td>{m ? m.name : `Emp #${a.employeeId}`}</td>
                                <td>{a.hours} hrs</td>
                                <td>
                                  <span
                                    className={`status-pill ${
                                      a.status.toLowerCase() === "present"
                                        ? "verified"
                                        : a.status.toLowerCase() === "leave"
                                        ? "pending"
                                        : a.status
                                            .toLowerCase()
                                            .includes("half")
                                        ? "needs-clarification"
                                        : "rejected"
                                    }`}
                                  >
                                    {a.status}
                                  </span>
                                </td>
                                <td>
                                  {(isAdmin ||
                                    a.employeeId === sessionEmployeeId) && (
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={() =>
                                        editRecordModal("attendance", a.id)
                                      }
                                    >
                                      <Edit2 size={13} />
                                      <span>Edit</span>
                                    </button>
                                  )}
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
            </>
          )}
        </>
      )}

          {/* =========================================================
              2. DAILY LOGS MODULE
             ========================================================= */}
          {currentTab === "Daily Logs" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>Daily Activity Logs</h1>
                  <p>
                    {isAdmin
                      ? "Review, verify, and monitor verified units logged by team members."
                      : "Your personal activity feed and work verification history."}
                  </p>
                </div>
                <div className="header-actions">
                  <button className="btn-secondary" onClick={exportCSV}>
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => editRecordModal("logs")}
                  >
                    <Plus size={15} />
                    <span>Log Daily Activity</span>
                  </button>
                </div>
              </div>

              {/* Clarification Action Banner */}
              {myClarificationLogs.length > 0 && (
                <div className="clarification-alert-banner">
                  <div className="clarification-banner-left">
                    <AlertCircle size={22} className="alert-icon" />
                    <div>
                      <h4>
                        {isAdmin
                          ? `${myClarificationLogs.length} Daily Log${
                              myClarificationLogs.length > 1 ? "s" : ""
                            } Flagged for Clarification`
                          : `Action Required: Clarification Needed on ${
                              myClarificationLogs.length
                            } Daily Log${
                              myClarificationLogs.length > 1 ? "s" : ""
                            }`}
                      </h4>
                      <p>
                        {isAdmin
                          ? "These logs require additional information or verification from team members."
                          : `Divyanshi / Manager note: "${
                              myClarificationLogs[0].notes ||
                              "Please provide additional details on deliverables."
                            }"`}
                      </p>
                    </div>
                  </div>
                  {!isAdmin && (
                    <button
                      className="btn-primary btn-sm"
                      style={{
                        background: "#d97706",
                        borderColor: "#d97706",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() =>
                        editRecordModal("logs", myClarificationLogs[0].id)
                      }
                    >
                      <span>Update & Clarify Now</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Log Status Filter Tabs */}
              <div className="log-filter-tabs">
                {(
                  [
                    {
                      key: "All",
                      label: "All Logs",
                      count: visibleLogs().length,
                    },
                    {
                      key: "Needs clarification",
                      label: "Needs Clarification",
                      count: visibleLogs().filter(
                        (l) => l.status === "Needs clarification"
                      ).length,
                    },
                    {
                      key: "Pending",
                      label: "Pending Verification",
                      count: visibleLogs().filter((l) => l.status === "Pending")
                        .length,
                    },
                    {
                      key: "Verified",
                      label: "Verified",
                      count: visibleLogs().filter((l) => l.status === "Verified")
                        .length,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`log-filter-btn ${
                      logFilter === tab.key ? "active" : ""
                    }`}
                    onClick={() => setLogFilter(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span className="log-filter-badge">{tab.count}</span>
                  </button>
                ))}
              </div>

              <div className="card-panel">
                {filterRows(visibleLogs(), [
                  (l) => l.activity,
                  (l) => l.status,
                  (l) => l.source,
                  (l) => person(l.employeeId)?.name,
                ]).filter((l) => {
                  if (logFilter === "All") return true;
                  return l.status === logFilter;
                }).length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <ClipboardList size={22} />
                    </div>
                    <div className="empty-title">
                      {logFilter === "All"
                        ? "No daily logs recorded yet"
                        : `No logs found with status "${logFilter}"`}
                    </div>
                    <div className="empty-desc">
                      {logFilter === "All"
                        ? "Keep track of accomplishments, deliverable quantities, and daily output by submitting your first entry."
                        : "Switch filter tabs above to view other daily activity records."}
                    </div>
                    {logFilter === "All" && (
                      <button
                        className="btn-primary"
                        onClick={() => editRecordModal("logs")}
                      >
                        <Plus size={14} />
                        <span>Log First Activity</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          {isAdmin && <th>Member</th>}
                          <th>Activity Details</th>
                          <th>Units</th>
                          <th>Status</th>
                          <th>Source</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(visibleLogs(), [
                          (l) => l.activity,
                          (l) => l.status,
                          (l) => l.source,
                          (l) => person(l.employeeId)?.name,
                        ])
                          .filter((l) => {
                            if (logFilter === "All") return true;
                            return l.status === logFilter;
                          })
                          .map((l) => (
                            <tr key={l.id}>
                              <td style={{ whiteSpace: "nowrap" }}>{l.date}</td>
                              {isAdmin && (
                                <td style={{ fontWeight: 600 }}>
                                  {person(l.employeeId)?.name ||
                                    `ID #${l.employeeId}`}
                                </td>
                              )}
                              <td style={{ maxWidth: "340px" }}>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    color: "#1e293b",
                                  }}
                                >
                                  {l.activity}
                                </div>
                                {l.notes && (
                                  <div className="log-notes-badge">
                                    <AlertCircle
                                      size={12}
                                      style={{
                                        color: "#d97706",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span>{l.notes}</span>
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>{l.quantity}</td>
                              <td>
                                <span
                                  className={`status-pill ${
                                    l.status === "Verified"
                                      ? "verified"
                                      : l.status === "Needs clarification"
                                      ? "needs-clarification"
                                      : "pending"
                                  }`}
                                >
                                  {l.status}
                                </span>
                              </td>
                              <td
                                style={{ color: "#64748b", fontSize: "12px" }}
                              >
                                {l.source}
                              </td>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "6px",
                                    alignItems: "center",
                                  }}
                                >
                                  {isAdmin && l.status !== "Verified" && (
                                    <button
                                      className="btn-verify-quick"
                                      title="1-click approve & verify"
                                      onClick={() => quickVerify(l.id)}
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>Verify</span>
                                    </button>
                                  )}
                                  {isAdmin &&
                                    l.status !== "Needs clarification" && (
                                      <button
                                        className="btn-clarify-quick"
                                        title="Request clarification from team member"
                                        onClick={() => openClarifyModal(l)}
                                      >
                                        <AlertCircle size={13} />
                                        <span>Clarify</span>
                                      </button>
                                    )}
                                  {!isAdmin &&
                                    l.status === "Needs clarification" && (
                                      <button
                                        className="btn-primary btn-sm"
                                        style={{
                                          background: "#d97706",
                                          borderColor: "#d97706",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                        }}
                                        title="Respond & clarify"
                                        onClick={() =>
                                          editRecordModal("logs", l.id)
                                        }
                                      >
                                        <Edit2 size={12} />
                                        <span>Clarify</span>
                                      </button>
                                    )}
                                  <button
                                    className="btn-secondary btn-sm"
                                    onClick={() => editRecordModal("logs", l.id)}
                                    title="Edit record"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  {(isAdmin ||
                                    l.employeeId === sessionEmployeeId) && (
                                    <button
                                      className="btn-danger btn-sm"
                                      onClick={() => removeRecord("logs", l.id)}
                                      title="Delete record"
                                    >
                                      <Trash2 size={13} />
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
            </>
          )}

          {/* =========================================================
              3. KPI & PERFORMANCE STANDARDS
             ========================================================= */}
          {currentTab === "KPI & Performance" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>KPI & Performance Standards</h1>
                  <p>
                    Standardized deliverables, departmental benchmarks, and evaluation weights.
                  </p>
                </div>
                {isAdmin && (
                  <div className="header-actions">
                    <button
                      className="btn-primary"
                      onClick={() => editRecordModal("kpis")}
                    >
                      <Plus size={15} />
                      <span>New KPI Standard</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="card-panel">
                {filterRows(db.kpis, [
                  (k) => k.name,
                  (k) => k.team,
                ]).length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <Target size={22} />
                    </div>
                    <div className="empty-title">No KPI standards defined yet</div>
                    <div className="empty-desc">
                      Configure target expectations, weights, and metric goals for each operational department.
                    </div>
                    {isAdmin && (
                      <button
                        className="btn-primary"
                        onClick={() => editRecordModal("kpis")}
                      >
                        <Plus size={14} />
                        <span>Define KPI Standard</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Standard KPI Name</th>
                          <th>Monthly Target</th>
                          <th>Evaluation Weight</th>
                          {isAdmin && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(db.kpis, [
                          (k) => k.name,
                          (k) => k.team,
                        ]).map((k) => (
                          <tr key={k.id}>
                            <td>
                              <span className="status-pill active">{k.team}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{k.name}</td>
                            <td>{k.target} units</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div className="bar-track" style={{ width: "80px" }}>
                                  <div
                                    className="bar-fill"
                                    style={{ width: `${Math.min(100, k.weight)}%` }}
                                  ></div>
                                </div>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>
                                  {k.weight}%
                                </span>
                              </div>
                            </td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    className="btn-secondary btn-sm"
                                    onClick={() => editRecordModal("kpis", k.id)}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    className="btn-danger btn-sm"
                                    onClick={() => removeRecord("kpis", k.id)}
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
            </>
          )}

          {/* =========================================================
              4. EMPLOYEE DIRECTORY
             ========================================================= */}
          {currentTab === "Employee Directory" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>Employee Directory</h1>
                  <p>
                    Workforce roster, departmental assignments, and performance targets.
                  </p>
                </div>
                {isAdmin && (
                  <div className="header-actions">
                    <button
                      className="btn-primary"
                      onClick={() => editRecordModal("employees")}
                    >
                      <Plus size={15} />
                      <span>Add Employee</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="card-panel">
                {filterRows(visibleEmployees(), [
                  (e) => e.name,
                  (e) => e.email,
                  (e) => e.team,
                  (e) => e.role,
                ]).length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <Users size={22} />
                    </div>
                    <div className="empty-title">No employees registered yet</div>
                    <div className="empty-desc">
                      Add team members with their official @virtualsolutionsindia.com email and monthly targets.
                    </div>
                    {isAdmin && (
                      <button
                        className="btn-primary"
                        onClick={() => editRecordModal("employees")}
                      >
                        <Plus size={14} />
                        <span>Add First Employee</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name & Email</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th>System Role</th>
                          <th>Monthly Target</th>
                          <th>Achieved</th>
                          <th>Progress</th>
                          <th>Status</th>
                          {isAdmin && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(visibleEmployees(), [
                          (e) => e.name,
                          (e) => e.email,
                          (e) => e.team,
                          (e) => e.role,
                          (e) => e.accessRole,
                        ]).map((e) => {
                          const sc = score(e);
                          return (
                            <tr key={e.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>
                                  {e.name}
                                </div>
                                <div style={{ fontSize: "11px", color: "#64748b" }}>
                                  {e.email}
                                </div>
                              </td>
                              <td>{e.team}</td>
                              <td style={{ color: "#334155" }}>{e.role}</td>
                              <td>
                                <span
                                  className={`status-pill ${
                                    e.accessRole === "Admin" ? "present" : "half-day"
                                  }`}
                                >
                                  {e.accessRole === "Admin" ? "Admin (Manager)" : "Employee"}
                                </span>
                              </td>
                              <td>{e.target} units</td>
                              <td style={{ fontWeight: 600 }}>{e.done} units</td>
                              <td style={{ width: "130px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <div className="bar-track">
                                    <div
                                      className="bar-fill"
                                      style={{
                                        width: `${sc}%`,
                                        background: sc >= 80 ? "#10b981" : "#2563eb",
                                      }}
                                    ></div>
                                  </div>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    {sc}%
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`status-pill ${
                                    e.status === "Active" ? "active" : "inactive"
                                  }`}
                                >
                                  {e.status}
                                </span>
                              </td>
                              {isAdmin && (
                                <td>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={() => editRecordModal("employees", e.id)}
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      className="btn-danger btn-sm"
                                      onClick={() => removeRecord("employees", e.id)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* =========================================================
              5. ATTENDANCE & LEAVE MODULE
             ========================================================= */}
          {currentTab === "Attendance & Leave" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>Attendance & Leave Log</h1>
                  <p>Daily shift verification, duty hours, and absence management.</p>
                </div>
                <div className="header-actions">
                  <button
                    className="btn-primary"
                    onClick={() => editRecordModal("attendance")}
                  >
                    <Plus size={15} />
                    <span>Log Attendance</span>
                  </button>
                </div>
              </div>

              <div className="card-panel">
                {filterRows(visibleAttendance(), [
                  (a) => a.status,
                  (a) => person(a.employeeId)?.name,
                ]).length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <CalendarCheck size={22} />
                    </div>
                    <div className="empty-title">No attendance logs found</div>
                    <div className="empty-desc">
                      Log daily presence, work hours, remote shifts, or leave requests.
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => editRecordModal("attendance")}
                    >
                      <Plus size={14} />
                      <span>Log Attendance Entry</span>
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          {isAdmin && <th>Member</th>}
                          <th>Duty Hours</th>
                          <th>Status</th>
                          {isAdmin && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(visibleAttendance(), [
                          (a) => a.status,
                          (a) => person(a.employeeId)?.name,
                        ]).map((a) => (
                          <tr key={a.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{a.date}</td>
                            {isAdmin && (
                              <td style={{ fontWeight: 600 }}>
                                {person(a.employeeId)?.name || `ID #${a.employeeId}`}
                              </td>
                            )}
                            <td>{a.hours} hrs</td>
                            <td>
                              <span
                                className={`status-pill ${
                                  a.status === "Present"
                                    ? "present"
                                    : a.status === "Half day"
                                    ? "half-day"
                                    : a.status === "Leave"
                                    ? "leave"
                                    : "absent"
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    className="btn-secondary btn-sm"
                                    onClick={() => editRecordModal("attendance", a.id)}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    className="btn-danger btn-sm"
                                    onClick={() => removeRecord("attendance", a.id)}
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
            </>
          )}

          {/* =========================================================
              6. LEADERBOARD & CERTIFICATES MODULE
             ========================================================= */}
          {currentTab === "Leaderboard & Certificates" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>Performance Leaderboard & Certificates</h1>
                  <p>
                    Ranked achievement, performance recognition, and verified certificates.
                  </p>
                </div>
              </div>

              <div className="card-panel">
                {filterRows(topSortedEmployees, [
                  (e) => e.name,
                  (e) => e.team,
                ]).length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <Award size={22} />
                    </div>
                    <div className="empty-title">No leaderboard standings available</div>
                    <div className="empty-desc">
                      Leaderboard ranks are compiled as employees record verified performance against targets.
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
                          <th>Target vs Achieved</th>
                          <th>Achievement</th>
                          <th>Recognition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(topSortedEmployees, [
                          (e) => e.name,
                          (e) => e.team,
                        ]).map((e, index) => {
                          const sc = score(e);
                          const isTop = index === 0 && sc > 0;
                          return (
                            <tr key={e.id}>
                              <td style={{ fontWeight: 700, color: isTop ? "#d97706" : "#64748b" }}>
                                #{index + 1}
                              </td>
                              <td style={{ fontWeight: 600 }}>{e.name}</td>
                              <td>{e.team}</td>
                              <td>
                                {e.done} / {e.target} units
                              </td>
                              <td>
                                <span
                                  className={`status-pill ${
                                    sc >= 85 ? "verified" : "pending"
                                  }`}
                                >
                                  {sc}% Achieved
                                </span>
                              </td>
                              <td>
                                {sc > 0 ? (
                                  <button
                                    className="btn-secondary btn-sm"
                                    onClick={() =>
                                      showCertificate(e.id, winners.some((w) => w.id === e.id))
                                    }
                                  >
                                    <Printer size={13} />
                                    <span>Generate Certificate</span>
                                  </button>
                                ) : (
                                  <button
                                    className="btn-secondary btn-sm"
                                    disabled
                                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                                    title="Verified performance above 0% required to generate certificate"
                                  >
                                    <Lock size={12} />
                                    <span>Requires &gt;0%</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* =========================================================
              7. REPORTS & AUDIT MODULE
             ========================================================= */}
          {currentTab === "Reports & Audit" && (
            <>
              <div className="module-header">
                <div className="header-text">
                  <h1>Data Reports & Audit Trail</h1>
                  <p>System backups, operational audit logs, and compliance records.</p>
                </div>
                <div className="header-actions">
                  <button className="btn-secondary" onClick={exportCSV}>
                    <Download size={14} />
                    <span>Export CSV Logs</span>
                  </button>
                  <button className="btn-secondary" onClick={exportJSON}>
                    <FolderDown size={14} />
                    <span>Download JSON Backup</span>
                  </button>
                </div>
              </div>

              {/* Audit Log Table */}
              <div className="card-panel">
                <div className="card-header">
                  <div className="card-title">
                    <Clock size={16} />
                    <span>Security & Audit Trail</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Logged events & state changes
                  </span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {filterRows(db.audit, [
                    (a) => a.actor,
                    (a) => a.action,
                    (a) => a.details,
                  ]).length === 0 ? (
                    <div className="empty-box">
                      <div className="empty-icon">
                        <Shield size={22} />
                      </div>
                      <div className="empty-title">Audit trail is currently clear</div>
                      <div className="empty-desc">
                        System operations, record edits, and security events will log here automatically.
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Timestamp</th>
                            <th>Actor Account</th>
                            <th>Action</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filterRows(db.audit, [
                            (a) => a.actor,
                            (a) => a.action,
                            (a) => a.details,
                          ]).map((a) => (
                            <tr key={a.id}>
                              <td style={{ whiteSpace: "nowrap", fontSize: "12px" }}>
                                {a.at}
                              </td>
                              <td style={{ fontWeight: 600, color: "#1e293b" }}>
                                {a.actor}
                              </td>
                              <td>
                                <span className="status-pill present">{a.action}</span>
                              </td>
                              <td style={{ color: "#64748b", fontSize: "12px" }}>
                                {a.details}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Dynamic Modal Container */}
      {activeModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            {activeModal}
          </div>
        </div>
      )}
    </div>
  );
}
