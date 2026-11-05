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

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

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

      syncAudit(
        id ? `Updated ${type}` : `Added ${type}`,
        formData.name || formData.activity || formData.type || "record"
      );
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

  // Certificate Modal
  const showCertificate = (id: number, winner: boolean) => {
    const e = person(id);
    if (!e) return;
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

                  {/* Footer: Signatures & Gold Seal */}
                  <div className="cert-footer-layout">
                    {/* Left Signature */}
                    <div className="sig-column">
                      <div className="sig-script-sign">Rohith Kumar</div>
                      <div className="sig-rule-line"></div>
                      <div className="sig-title-label">Head of Operations</div>
                      <div className="sig-org-label">Virtual Solutions India</div>
                    </div>

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

                    {/* Right Signature */}
                    <div className="sig-column">
                      <div className="sig-script-sign">Executive Board</div>
                      <div className="sig-rule-line"></div>
                      <div className="sig-title-label">Director of Performance</div>
                      <div className="sig-org-label">VSI Corporate Oversight</div>
                    </div>
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
    if (!isAdmin && type !== "logs") return;
    const old = (db[type] as any[]).find((r) => r.id === id) || {};
    const title =
      (id ? "Edit " : "New ") +
      (type === "employees"
        ? "Employee Record"
        : type === "logs"
        ? "Daily Activity Log"
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

            // Default employeeId for Employee role submitting a log
            if (!isAdmin && type === "logs") {
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
                  <div>
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
                </>
              )}

              {type === "logs" && (
                <>
                  <div>
                    <label>Activity Date</label>
                    <input
                      name="date"
                      type="date"
                      defaultValue={
                        old.date || new Date().toISOString().split("T")[0]
                      }
                      required
                    />
                  </div>
                  {isAdmin ? (
                    <div>
                      <label>Team Member</label>
                      <select
                        name="employeeId"
                        defaultValue={old.employeeId || db.employees[0]?.id}
                        required
                      >
                        {db.employees.length > 0 ? (
                          db.employees.map((e) => (
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
                    <label>Task / Activity Description</label>
                    <textarea
                      name="activity"
                      rows={3}
                      defaultValue={old.activity || ""}
                      placeholder="Detail completed deliverables and accomplishments..."
                      required
                    />
                  </div>
                  <div>
                    <label>Units Completed</label>
                    <input
                      name="quantity"
                      type="number"
                      defaultValue={old.quantity ?? 1}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label>Verification Status</label>
                    <select
                      name="status"
                      defaultValue={old.status || (isAdmin ? "Verified" : "Pending")}
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
                      defaultValue={old.source || "Web Portal Submission"}
                      required
                    />
                  </div>
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
                      defaultValue={old.employeeId || db.employees[0]?.id}
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

  const totalVerifiedUnits = db.logs
    .filter((l) => l.status === "Verified")
    .reduce((a, l) => a + (Number(l.quantity) || 0), 0);

  const activeHeadcount = db.employees.filter((e) => e.status === "Active").length;

  const topSortedEmployees = [...es].sort((a, b) => score(b) - score(a));
  const topScoreValue = topSortedEmployees[0] ? score(topSortedEmployees[0]) : 0;
  const winners = topSortedEmployees.filter(
    (e) => score(e) === topScoreValue && topScoreValue > 0
  );

  // Chart setup
  useEffect(() => {
    if (currentTab === "Dashboard" && chartRef.current) {
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

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [currentTab, es.length, overallAvg]);

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
                  <h1>Executive Performance Overview</h1>
                  <p>
                    {isAdmin
                      ? "Real-time key performance indicators and organizational health metrics."
                      : "Your personal progress, completed deliverables, and performance benchmarks."}
                  </p>
                </div>
                <div className="header-actions">
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
                </div>
              </div>

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
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={() =>
                                        showCertificate(e.id, winners.some((w) => w.id === e.id))
                                      }
                                    >
                                      <Printer size={13} />
                                      <span>View</span>
                                    </button>
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

              <div className="card-panel">
                {filterRows(visibleLogs(), [
                  (l) => l.activity,
                  (l) => l.status,
                  (l) => l.source,
                  (l) => person(l.employeeId)?.name,
                ]).length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <ClipboardList size={22} />
                    </div>
                    <div className="empty-title">No daily logs recorded yet</div>
                    <div className="empty-desc">
                      Keep track of accomplishments, deliverable quantities, and daily output by submitting your first entry.
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => editRecordModal("logs")}
                    >
                      <Plus size={14} />
                      <span>Log First Activity</span>
                    </button>
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
                        ]).map((l) => (
                          <tr key={l.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{l.date}</td>
                            {isAdmin && (
                              <td style={{ fontWeight: 600 }}>
                                {person(l.employeeId)?.name || `ID #${l.employeeId}`}
                              </td>
                            )}
                            <td style={{ maxWidth: "340px" }}>{l.activity}</td>
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
                            <td style={{ color: "#64748b", fontSize: "12px" }}>
                              {l.source}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {isAdmin && l.status !== "Verified" && (
                                  <button
                                    className="btn-secondary btn-sm"
                                    title="Quick verify"
                                    onClick={() =>
                                      saveRecord("logs", l.id, {
                                        ...l,
                                        status: "Verified",
                                      })
                                    }
                                  >
                                    <CheckCircle2 size={13} style={{ color: "#10b981" }} />
                                    <span>Verify</span>
                                  </button>
                                )}
                                <button
                                  className="btn-secondary btn-sm"
                                  onClick={() => editRecordModal("logs", l.id)}
                                >
                                  <Edit2 size={13} />
                                </button>
                                {(isAdmin || l.employeeId === sessionEmployeeId) && (
                                  <button
                                    className="btn-danger btn-sm"
                                    onClick={() => removeRecord("logs", l.id)}
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
                                <button
                                  className="btn-secondary btn-sm"
                                  onClick={() =>
                                    showCertificate(e.id, winners.some((w) => w.id === e.id))
                                  }
                                >
                                  <Printer size={13} />
                                  <span>Generate Certificate</span>
                                </button>
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
