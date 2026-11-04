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

  // User session & Role handling: Exactly 2 roles -> Admin (Manager) and Employee
  const sessionEmail = initialUser.email || "admin@virtualsolutionsindia.com";
  const initialRole =
    initialUser.role?.toLowerCase() === "employee" ? "Employee" : "Admin";

  const [activeRole, setActiveRole] = useState<"Admin" | "Employee">(initialRole);
  const sessionEmployeeId = initialUser.id ? Number(initialUser.id) : 1;

  const isAdmin = activeRole === "Admin";

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // 7 Navigation Modules
  const navigationItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Daily Logs", icon: ClipboardList },
    { name: "KPI & Targets", icon: Target },
    { name: "Employee Directory", icon: Users },
    { name: "Attendance & Leave", icon: CalendarCheck },
    { name: "Leaderboard & Awards", icon: Award },
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
    const scoreline = winner
      ? "Recognized for outstanding contributions and leading monthly benchmarks."
      : `Verified KPI Achievement: ${score(e)}%`;

    openModal(
      <div className="modal-dialog" style={{ maxWidth: "620px" }}>
        <div className="modal-head">
          <h2>Performance Certificate</h2>
          <button className="modal-close-btn" onClick={closeModal}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-content">
          <div className="cert-preview-card" id="certificate-print-area">
            <div className="cert-brand">VIRTUAL SOLUTIONS INDIA</div>
            <h2 className="cert-headline">
              {winner ? "Certificate of Excellence" : "Performance Certificate"}
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              This honor is proudly awarded to
            </p>
            <div className="cert-recipient">{e.name}</div>
            <p style={{ fontSize: "14px", color: "#334155", maxWidth: "440px", margin: "0 auto" }}>
              {scoreline}
            </p>
            <div style={{ marginTop: "24px", fontSize: "12px", color: "#94a3b8" }}>
              Verified Performance Record · VSI Pulse Portal
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
                <html>
                  <head>
                    <title>VSI Certificate - ${e.name}</title>
                    <style>
                      body { font-family: Georgia, serif; text-align: center; padding: 40px; background: #fafafa; }
                      .cert-preview-card { border: 10px double #c59b27; padding: 60px 40px; background: #fff; max-width: 700px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                      .cert-brand { font-size: 13px; font-weight: bold; letter-spacing: 2px; color: #475569; margin-bottom: 12px; }
                      .cert-headline { font-size: 32px; color: #1e3a8a; margin: 0 0 16px; }
                      .cert-recipient { font-size: 36px; color: #0f172a; margin: 20px 0; border-bottom: 2px solid #e2e8f0; display: inline-block; padding: 0 30px 8px; }
                      p { color: #475569; line-height: 1.6; }
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
            {/* Role Switcher (Admin / Employee) */}
            <div className="role-selector">
              <label>Role:</label>
              <select
                className="role-select"
                value={activeRole}
                onChange={(e) =>
                  setActiveRole(e.target.value as "Admin" | "Employee")
                }
              >
                <option value="Admin">Admin (Manager)</option>
                <option value="Employee">Employee</option>
              </select>
            </div>

            {/* User Profile */}
            <div className="user-profile">
              <div className="avatar-badge">
                {(sessionEmail.split("@")[0] || "AD").slice(0, 2).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">
                  {initialUser.name || sessionEmail.split("@")[0]}
                </span>
                <span className="user-role-tag">{activeRole}</span>
              </div>
            </div>

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
                      <span>Leading Performers</span>
                    </div>
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
          {currentTab === "KPI & Targets" && (
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
              6. LEADERBOARD & AWARDS MODULE
             ========================================================= */}
          {currentTab === "Leaderboard & Awards" && (
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
