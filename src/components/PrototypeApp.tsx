"use client";

import React, { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import Chart from "chart.js/auto";

type Employee = {
  id: number;
  name: string;
  email: string;
  team: string;
  role: string;
  target: number;
  done: number;
  status: string;
};

type DailyLog = {
  id: number;
  date: string;
  employeeId: number;
  activity: string;
  quantity: number;
  status: string;
  source: string;
};

type Attendance = {
  id: number;
  date: string;
  employeeId: number;
  hours: number;
  status: string;
};

type Kpi = {
  id: number;
  team: string;
  name: string;
  target: number;
  weight: number;
};

type AlertItem = {
  id: number;
  type: string;
  text: string;
  status: string;
};

type AuditItem = {
  id: number;
  at: string;
  actor: string;
  action: string;
  details: string;
};

type AppDb = {
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
  const [db, setDb] = useState<AppDb>({
    employees: [],
    logs: [],
    attendance: [],
    kpis: [],
    alerts: [],
    audit: [],
  });

  const [current, setCurrent] = useState<string>("Dashboard");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [period, setPeriod] = useState<string>("month");
  const [sideOpen, setSideOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<React.ReactNode | null>(null);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const session = {
    email: initialUser.email || "admin@virtualsolutionsindia.com",
    role: (initialUser.role
      ? initialUser.role.charAt(0).toUpperCase() + initialUser.role.slice(1)
      : "Admin") as "Admin" | "Manager" | "Employee",
    employeeId: initialUser.id ? Number(initialUser.id) : 1,
  };

  const pages: [string, string][] = [
    ["Dashboard", "◫"],
    ["Daily Logs", "▤"],
    ["KPI & Performance", "◎"],
    ["Employee Directory", "♙"],
    ["Attendance & Leave", "▦"],
    ["Leaderboard & Certificates", "★"],
    ["Reports & Audit", "▥"],
  ];

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

  const score = (e: Employee) =>
    e.target ? Math.min(100, Math.round((e.done / e.target) * 100)) : 0;

  const canEdit = () => session.role === "Admin";
  const canLogs = () => ["Admin", "Manager"].includes(session.role);

  const visibleEmployees = () => {
    if (session.role === "Employee") {
      return db.employees.filter((e) => e.id === session.employeeId);
    }
    if (session.role === "Manager") {
      return db.employees.filter(
        (e) => e.team === "Quality" || e.id === session.employeeId
      );
    }
    return db.employees;
  };

  const person = (id: number) => db.employees.find((e) => e.id === id);

  const filterRows = <T,>(rows: T[], getters: ((item: T) => string | number | undefined)[]) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      getters.some((g) => String(g(r) ?? "").toLowerCase().includes(q))
    );
  };

  const syncAudit = async (action: string, details: string) => {
    const newAudit = {
      id: Date.now(),
      at: new Date().toLocaleString(),
      actor: session.email,
      action,
      details,
    };
    setDb((prev) => ({ ...prev, audit: [newAudit, ...prev.audit] }));
  };

  // Chart rendering for Dashboard
  useEffect(() => {
    if (current === "Dashboard" && chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      const es = visibleEmployees();
      const avgScore = es.length
        ? Math.round(es.reduce((a, e) => a + score(e), 0) / es.length)
        : 78;

      const ctx = chartRef.current.getContext("2d");
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
            datasets: [
              {
                label: "KPI achievement",
                data: [58, 67, 74, avgScore],
                borderColor: "#4d5ce9",
                backgroundColor: "rgba(77,92,233,.10)",
                fill: true,
                tension: 0.4,
                pointRadius: 5,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 0, max: 100, grid: { color: "#eef1f8" } },
              x: { grid: { display: false } },
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
  }, [current, db.employees]);

  // Modals & CRUD
  const openModal = (content: React.ReactNode) => setActiveModal(content);
  const closeModal = () => setActiveModal(null);

  const saveRecord = async (type: keyof AppDb, id: number, formData: Record<string, any>) => {
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveRecord", type, id, record: formData }),
      });
      syncAudit(id ? `Updated ${type}` : `Added ${type}`, formData.name || formData.activity || formData.type || "record");
      closeModal();
      loadData();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const removeRecord = async (type: keyof AppDb, id: number) => {
    if (!canEdit() && !(type === "logs" && canLogs())) return;
    if (!window.confirm("Delete this record? The action will be logged.")) return;
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
    }
  };

  const toggleAlert = async (id: number) => {
    if (!canEdit()) return;
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
    }
  };

  const showCertificate = (id: number, winner: boolean) => {
    const e = person(id);
    if (!e) return;
    const scoreline = winner
      ? "Recognized for outstanding contributions during the selected period."
      : "KPI achievement: " + score(e) + "/100";

    openModal(
      <div>
        <div className="modalhead">
          <h2>Certificate preview</h2>
          <button className="btn secondary tiny" onClick={closeModal}>✕</button>
        </div>
        <div className="cert" id="certificate">
          <div className="small">VIRTUAL SOLUTIONS INDIA</div>
          <h2>{winner ? "Certificate of Recognition" : "Performance Certificate"}</h2>
          <p>This certificate is presented to</p>
          <div className="name">{e.name}</div>
          <p>{scoreline}</p>
          <p style={{ marginTop: "20px" }}>November 2026 · VSI Pulse</p>
          <p className="footnote">Verified performance certificate</p>
        </div>
        <div className="toolbar" style={{ marginTop: "17px" }}>
          <button
            className="btn"
            onClick={() => {
              const html = document.getElementById("certificate")?.outerHTML || "";
              const w = window.open("", "_blank");
              if (!w) {
                alert("Allow pop-ups to print the certificate.");
                return;
              }
              w.document.write(
                "<html><head><title>VSI Certificate</title><style>body{font-family:Georgia;text-align:center;padding:50px}.cert{border:9px double #d6b877;padding:65px}.name{font-size:34px;margin:30px;color:#243f78}h2{font-size:30px}p{color:#526079}</style></head><body>" +
                  html +
                  "</body></html>"
              );
              w.document.close();
              w.focus();
              setTimeout(() => w.print(), 350);
            }}
          >
            Print / Save PDF
          </button>
          <button className="btn secondary" onClick={closeModal}>Close</button>
        </div>
      </div>
    );
  };

  const exportCSV = () => {
    const rows = [
      ["Date", "Employee", "Activity", "Quantity", "Status", "Source"],
      ...db.logs.map((l) => [
        l.date,
        person(l.employeeId)?.name || "",
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
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vsi-pulse-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const editRecordModal = (type: keyof AppDb, id?: number) => {
    if (!canEdit() && !(type === "logs" && canLogs())) return;
    const old = (db[type] as any[]).find((r) => r.id === id) || {};
    const title = (id ? "Edit " : "Add ") + (type === "employees" ? "employee" : type === "logs" ? "daily log" : type.slice(0, -1));

    openModal(
      <div>
        <div className="modalhead">
          <h2>{title}</h2>
          <button className="btn secondary tiny" onClick={closeModal}>✕</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const data: Record<string, any> = {};
            fd.forEach((val, key) => {
              data[key] = ["target", "done", "quantity", "weight", "hours", "employeeId"].includes(key)
                ? Number(val)
                : val;
            });
            saveRecord(type, id || 0, data);
          }}
        >
          <div className="formgrid">
            {type === "employees" && (
              <>
                <div className="field">
                  <label>Name</label>
                  <input name="name" defaultValue={old.name || ""} required />
                </div>
                <div className="field">
                  <label>VSI Email</label>
                  <input name="email" type="email" defaultValue={old.email || ""} required />
                </div>
                <div className="field">
                  <label>Role</label>
                  <input name="role" defaultValue={old.role || ""} required />
                </div>
                <div className="field">
                  <label>Team</label>
                  <select name="team" defaultValue={old.team || "Operations"}>
                    <option value="Operations">Operations</option>
                    <option value="Quality">Quality</option>
                    <option value="Development">Development</option>
                    <option value="Catalog">Catalog</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div className="field">
                  <label>Target</label>
                  <input name="target" type="number" defaultValue={old.target ?? 30} min="0" required />
                </div>
                <div className="field">
                  <label>Achieved</label>
                  <input name="done" type="number" defaultValue={old.done ?? 0} min="0" required />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select name="status" defaultValue={old.status || "Active"}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </>
            )}

            {type === "logs" && (
              <>
                <div className="field">
                  <label>Report date</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={old.date || new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
                <div className="field">
                  <label>Employee</label>
                  <select name="employeeId" defaultValue={old.employeeId || visibleEmployees()[0]?.id} required>
                    {visibleEmployees().map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Activity</label>
                  <textarea name="activity" defaultValue={old.activity || ""} required />
                </div>
                <div className="field">
                  <label>Verified units</label>
                  <input name="quantity" type="number" defaultValue={old.quantity ?? 0} min="0" required />
                </div>
                <div className="field">
                  <label>Verification status</label>
                  <select name="status" defaultValue={old.status || "Verified"}>
                    <option value="Verified">Verified</option>
                    <option value="Needs clarification">Needs clarification</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Source</label>
                  <input name="source" defaultValue={old.source || "Demo Slack report"} required />
                </div>
              </>
            )}

            {type === "kpis" && (
              <>
                <div className="field">
                  <label>Team</label>
                  <select name="team" defaultValue={old.team || "Operations"}>
                    <option value="Operations">Operations</option>
                    <option value="Quality">Quality</option>
                    <option value="Development">Development</option>
                    <option value="Catalog">Catalog</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div className="field">
                  <label>KPI Name</label>
                  <input name="name" defaultValue={old.name || ""} required />
                </div>
                <div className="field">
                  <label>Target</label>
                  <input name="target" type="number" defaultValue={old.target ?? 30} min="1" required />
                </div>
                <div className="field">
                  <label>Weight (%)</label>
                  <input name="weight" type="number" defaultValue={old.weight ?? 30} min="1" max="100" required />
                </div>
              </>
            )}

            {type === "attendance" && (
              <>
                <div className="field">
                  <label>Date</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={old.date || new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
                <div className="field">
                  <label>Employee</label>
                  <select name="employeeId" defaultValue={old.employeeId || visibleEmployees()[0]?.id} required>
                    {visibleEmployees().map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Hours</label>
                  <input name="hours" type="number" step="0.5" defaultValue={old.hours ?? 8} min="0" max="24" required />
                </div>
                <div className="field">
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
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Alert type</label>
                  <input name="type" defaultValue={old.type || ""} required />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Message</label>
                  <textarea name="text" defaultValue={old.text || ""} required />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select name="status" defaultValue={old.status || "Open"}>
                    <option value="Open">Open</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="actions" style={{ justifyContent: "flex-end", marginTop: "20px" }}>
            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn">Save changes</button>
          </div>
        </form>
      </div>
    );
  };

  const es = visibleEmployees();
  const avg = es.length ? Math.round(es.reduce((a, e) => a + score(e), 0) / es.length) : 0;
  const clar = db.logs.filter((l) => l.status === "Needs clarification").length;
  const verifiedUnits = db.logs
    .filter((l) => l.status === "Verified" && es.some((e) => e.id === l.employeeId))
    .reduce((a, l) => a + (+l.quantity || 0), 0);

  const topSorted = [...es].sort((a, b) => score(b) - score(a));
  const topScore = topSorted[0] ? score(topSorted[0]) : 0;
  const winners = topSorted.filter((e) => score(e) === topScore && topScore > 0);

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside id="side" className={`side ${sideOpen ? "open" : ""}`}>
        <div className="logo">
          VSI<span>Pulse.</span>
        </div>
        <div className="group">WORKSPACE</div>
        <div id="nav">
          {pages.map(([p, icon]) => (
            <button
              key={p}
              className={`nav ${current === p ? "active" : ""}`}
              onClick={() => {
                setCurrent(p);
                setSearchQuery("");
                setSideOpen(false);
              }}
            >
              <span className="symbol">{icon}</span>
              {p}
            </button>
          ))}
        </div>
        <div className="sidefoot">
          ● Connected
          <br />
          PostgreSQL Database · Live sync
        </div>
      </aside>

      {/* Main Container */}
      <main className="main">
        {/* Top Navbar */}
        <div className="top">
          <div className="actions">
            <button
              className="btn secondary mobilemenu"
              onClick={() => setSideOpen(!sideOpen)}
            >
              ☰
            </button>
            <input
              className="search"
              id="globalSearch"
              placeholder="Search this section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="actions">
            <span className="pill" id="roleBadge">
              {session.role} · Live
            </span>
            <span className="avatar" id="avatar">
              {(session.email.split("@")[0] || "AD").slice(0, 2).toUpperCase()}
            </span>
            <button
              className="btn secondary tiny"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div id="content">
          {/* 1. Dashboard View */}
          {current === "Dashboard" && (
            <div>
              <div className="head">
                <div>
                  <h1>Performance Overview</h1>
                  <p>Your people, progress, and performance — all in one place.</p>
                </div>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="month">This month</option>
                  <option value="week">This week</option>
                  <option value="day">Today</option>
                </select>
              </div>

              <div className="grid">
                <div className="panel metric">
                  <div className="small">Average KPI achievement</div>
                  <div className="value">{avg}%</div>
                  <div className="hint">Illustrative demo scores</div>
                </div>
                <div className="panel metric">
                  <div className="small">Team members</div>
                  <div className="value">{es.length}</div>
                  <div className="hint">Visible in your role</div>
                </div>
                <div className="panel metric">
                  <div className="small">Verified work units</div>
                  <div className="value">{verifiedUnits}</div>
                  <div className="hint">From sample daily logs</div>
                </div>
                <div className="panel metric">
                  <div className="small">Reports needing review</div>
                  <div className="value">{clar}</div>
                  <div className="hint">Review incomplete data</div>
                </div>
              </div>

              <div className="twocol">
                <div className="panel">
                  <div className="panelhead">
                    <h2>Performance trend</h2>
                    <span className="small">Demo illustration</span>
                  </div>
                  <div className="chartbox">
                    <canvas ref={chartRef}></canvas>
                  </div>
                </div>

                <div className="panel">
                  <div className="panelhead">
                    <h2>Top performers</h2>
                    <button
                      className="btn secondary tiny"
                      onClick={() => setCurrent("Leaderboard & Certificates")}
                    >
                      View all
                    </button>
                  </div>
                  {topSorted.slice(0, 4).map((e, i) => (
                    <div className="leader" key={e.id}>
                      <div className="rank">0{i + 1}</div>
                      <span className="avatar">{e.name[0]}</span>
                      <div className="grow">
                        <b>{e.name}</b>
                        <div className="small">{e.role}</div>
                      </div>
                      <b>{score(e)}%</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="twocol">
                <div className="panel">
                  <div className="panelhead">
                    <h2>Achievement by team</h2>
                  </div>
                  <div className="bars">
                    {es.map((e) => (
                      <div className="barline" key={e.id}>
                        <span>{e.name.split(" ")[0]}</span>
                        <div className="progress">
                          <div style={{ width: `${score(e)}%` }}></div>
                        </div>
                        <b>{score(e)}%</b>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <div className="panelhead">
                    <h2>Action center</h2>
                  </div>
                  {db.alerts.filter((a) => a.status === "Open").map((a) => (
                    <div className="notice" key={a.id} style={{ marginBottom: "9px" }}>
                      <b>{a.type}</b>
                      <br />
                      {a.text}
                    </div>
                  ))}
                  {db.alerts.filter((a) => a.status === "Open").length === 0 && (
                    <p>No open alerts.</p>
                  )}
                  <div className="footnote">
                    Live Slack notifications are connected via Webhooks.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Daily Logs View */}
          {current === "Daily Logs" && (
            <div>
              <div className="head">
                <div>
                  <h1>Daily Logs</h1>
                  <p>AI-ready work records with verification and corrections.</p>
                </div>
                {canLogs() && (
                  <button className="btn" onClick={() => editRecordModal("logs")}>
                    + Add log
                  </button>
                )}
              </div>

              <div className="panel">
                <div className="notice" style={{ marginBottom: "15px" }}>
                  Demo reports are editable. Slack thread ingestion, AI parsing, and missing-information notifications require backend integration.
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Activity</th>
                        <th>Units</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filterRows(
                        db.logs.filter((l) => es.some((e) => e.id === l.employeeId)),
                        [(l) => person(l.employeeId)?.name, (l) => l.activity, (l) => l.status]
                      ).map((l) => (
                        <tr key={l.id}>
                          <td>{l.date}</td>
                          <td>
                            <b>{person(l.employeeId)?.name || "Unknown"}</b>
                          </td>
                          <td>
                            {l.activity}
                            <div className="small">{l.source}</div>
                          </td>
                          <td>{l.quantity || "—"}</td>
                          <td>
                            <span
                              className={`tag ${
                                /clarification|leave|pending/i.test(l.status)
                                  ? "warn"
                                  : /low|absent|error/i.test(l.status)
                                  ? "bad"
                                  : ""
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>
                          <td>
                            {canLogs() ? (
                              <>
                                <button
                                  className="btn secondary tiny"
                                  onClick={() => editRecordModal("logs", l.id)}
                                >
                                  Edit
                                </button>{" "}
                                <button
                                  className="btn danger tiny"
                                  onClick={() => removeRecord("logs", l.id)}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              "View only"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. KPI & Performance View */}
          {current === "KPI & Performance" && (
            <div>
              <div className="head">
                <div>
                  <h1>KPI & Performance</h1>
                  <p>Track measurable achievements against assigned targets.</p>
                </div>
                {canEdit() && (
                  <button className="btn" onClick={() => editRecordModal("kpis")}>
                    + Add KPI
                  </button>
                )}
              </div>

              <div className="grid">
                <div className="panel metric">
                  <div className="small">Average achievement</div>
                  <div className="value">{avg}%</div>
                  <div className="hint">Demo normalized score</div>
                </div>
                <div className="panel metric">
                  <div className="small">KPI standards</div>
                  <div className="value">{db.kpis.length}</div>
                  <div className="hint">Editable by Admin</div>
                </div>
                <div className="panel metric">
                  <div className="small">On-track employees</div>
                  <div className="value">{es.filter((e) => score(e) >= 75).length}</div>
                  <div className="hint">75% or above</div>
                </div>
                <div className="panel metric">
                  <div className="small">Below standard</div>
                  <div className="value">{es.filter((e) => score(e) < 40).length}</div>
                  <div className="hint">Below 40%</div>
                </div>
              </div>

              <div className="twocol">
                <div className="panel">
                  <div className="panelhead">
                    <h2>Employee progress</h2>
                  </div>
                  {es.map((e) => (
                    <div style={{ margin: "15px 0" }} key={e.id}>
                      <div className="panelhead" style={{ marginBottom: "8px" }}>
                        <b>{e.name}</b>
                        <span>
                          {e.done}/{e.target} · {score(e)}%
                        </span>
                      </div>
                      <div className="progress">
                        <div style={{ width: `${score(e)}%` }}></div>
                      </div>
                      {canEdit() && (
                        <div style={{ marginTop: "7px" }}>
                          <button
                            className="btn secondary tiny"
                            onClick={() => editRecordModal("employees", e.id)}
                          >
                            Adjust target / achieved
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="panel">
                  <div className="panelhead">
                    <h2>Role KPI standards</h2>
                  </div>
                  {db.kpis.map((k) => (
                    <div className="leader" key={k.id}>
                      <div className="grow">
                        <b>{k.name}</b>
                        <div className="small">
                          {k.team} · Target {k.target} · Weight {k.weight}%
                        </div>
                      </div>
                      {canEdit() && (
                        <>
                          <button
                            className="btn secondary tiny"
                            onClick={() => editRecordModal("kpis", k.id)}
                          >
                            Edit
                          </button>{" "}
                          <button
                            className="btn danger tiny"
                            onClick={() => removeRecord("kpis", k.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="footnote">
                Prototype scores are simplified achieved ÷ target. Production scoring must use verified role-specific weighted KPIs, attendance adjustments, and historical versions.
              </p>
            </div>
          )}

          {/* 4. Employee Directory View */}
          {current === "Employee Directory" && (
            <div>
              <div className="head">
                <div>
                  <h1>Employee Directory</h1>
                  <p>People, teams, and access profiles.</p>
                </div>
                {canEdit() && (
                  <button className="btn" onClick={() => editRecordModal("employees")}>
                    + Add employee
                  </button>
                )}
              </div>

              <div className="panel">
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Team</th>
                        <th>Target</th>
                        <th>Achievement</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filterRows(es, [(e) => e.name, (e) => e.role, (e) => e.team]).map((e) => (
                        <tr key={e.id}>
                          <td>
                            <b>{e.name}</b>
                            <div className="small">{e.email}</div>
                          </td>
                          <td>{e.role}</td>
                          <td>{e.team}</td>
                          <td>{e.target}</td>
                          <td>{score(e)}%</td>
                          <td>
                            <span
                              className={`tag ${
                                e.status === "Active" ? "" : "bad"
                              }`}
                            >
                              {e.status}
                            </span>
                          </td>
                          <td>
                            {canEdit() ? (
                              <>
                                <button
                                  className="btn secondary tiny"
                                  onClick={() => editRecordModal("employees", e.id)}
                                >
                                  Edit
                                </button>{" "}
                                <button
                                  className="btn danger tiny"
                                  onClick={() => removeRecord("employees", e.id)}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              "View only"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. Attendance & Leave View */}
          {current === "Attendance & Leave" && (
            <div>
              <div className="head">
                <div>
                  <h1>Attendance & Leave</h1>
                  <p>Working hours, presence, and leave records.</p>
                </div>
                {canEdit() && (
                  <button className="btn" onClick={() => editRecordModal("attendance")}>
                    + Add attendance
                  </button>
                )}
              </div>

              <div className="grid">
                <div className="panel metric">
                  <div className="small">Present</div>
                  <div className="value">
                    {db.attendance.filter((a) => a.status === "Present").length}
                  </div>
                  <div className="hint">Demo records</div>
                </div>
                <div className="panel metric">
                  <div className="small">On leave</div>
                  <div className="value">
                    {db.attendance.filter((a) => a.status === "Leave").length}
                  </div>
                  <div className="hint">Demo records</div>
                </div>
                <div className="panel metric">
                  <div className="small">Total tracked hours</div>
                  <div className="value">
                    {db.attendance
                      .reduce((a, r) => a + (+r.hours || 0), 0)
                      .toFixed(1)}
                  </div>
                  <div className="hint">Demo records</div>
                </div>
                <div className="panel metric">
                  <div className="small">Attendance source</div>
                  <div className="value" style={{ fontSize: "24px" }}>Jibble</div>
                  <div className="hint">Preferred integration</div>
                </div>
              </div>

              <div className="panel section">
                <div className="notice" style={{ marginBottom: "15px" }}>
                  Live Jibble and Google Sheets syncing is connected with PostgreSQL database.
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Hours</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filterRows(
                        db.attendance.filter((a) => es.some((e) => e.id === a.employeeId)),
                        [(a) => person(a.employeeId)?.name, (a) => a.status]
                      ).map((a) => (
                        <tr key={a.id}>
                          <td>{a.date}</td>
                          <td>{person(a.employeeId)?.name || "Unknown"}</td>
                          <td>{a.hours}h</td>
                          <td>
                            <span
                              className={`tag ${
                                /leave|half/i.test(a.status)
                                  ? "warn"
                                  : /absent/i.test(a.status)
                                  ? "bad"
                                  : ""
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td>
                            {canEdit() ? (
                              <>
                                <button
                                  className="btn secondary tiny"
                                  onClick={() => editRecordModal("attendance", a.id)}
                                >
                                  Edit
                                </button>{" "}
                                <button
                                  className="btn danger tiny"
                                  onClick={() => removeRecord("attendance", a.id)}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              "View only"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 6. Leaderboard & Certificates View */}
          {current === "Leaderboard & Certificates" && (
            <div>
              <div className="head">
                <div>
                  <h1>Leaderboard & Certificates</h1>
                  <p>Recognize progress and celebrate verified contributions.</p>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => showCertificate(session.employeeId, false)}
                >
                  My certificate
                </button>
              </div>

              <div className="twocol">
                <div className="panel">
                  <div className="panelhead">
                    <h2>Company leaderboard</h2>
                    <span className="pill">Monthly · Demo</span>
                  </div>
                  {topSorted.map((e, i) => (
                    <div className="leader" key={e.id}>
                      <div className="rank">{i + 1}</div>
                      <span className="avatar">{e.name[0]}</span>
                      <div className="grow">
                        <b>{e.name}</b>
                        <div className="small">
                          {e.team} · {e.role}
                        </div>
                      </div>
                      {i === 0 && <span className="tag">Winner</span>}
                      <button
                        className="btn secondary tiny"
                        onClick={() => showCertificate(e.id, i === 0)}
                      >
                        Certificate
                      </button>
                    </div>
                  ))}
                </div>

                <div className="panel">
                  <div className="panelhead">
                    <h2>Monthly recognition</h2>
                  </div>
                  <div style={{ fontSize: "50px", textAlign: "center" }}>🏆</div>
                  <h2 style={{ textAlign: "center", margin: "15px" }}>
                    {winners.map((e) => e.name).join(" & ") || topSorted[0]?.name}
                  </h2>
                  <p style={{ textAlign: "center" }}>
                    Current sample leaderboard winner{winners.length > 1 ? "s" : ""}
                  </p>
                  <div className="notice" style={{ marginTop: "20px" }}>
                    Certificates can be previewed and printed to PDF. Email delivery and verified achievement narratives require live integrations.
                  </div>
                  <button
                    className="btn"
                    style={{ width: "100%", marginTop: "18px" }}
                    onClick={() => showCertificate(winners[0]?.id || topSorted[0]?.id || 1, true)}
                  >
                    View winner certificate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. Reports & Audit View */}
          {current === "Reports & Audit" && (
            <div>
              <div className="head">
                <div>
                  <h1>Reports & Audit</h1>
                  <p>Export records and review system activity.</p>
                </div>
                <button className="btn" onClick={exportCSV}>
                  Export CSV
                </button>
              </div>

              <div className="grid">
                <div className="panel metric">
                  <div className="small">Audit events</div>
                  <div className="value">{db.audit.length}</div>
                  <div className="hint">Saved in PostgreSQL</div>
                </div>
                <div className="panel metric">
                  <div className="small">Daily logs</div>
                  <div className="value">{db.logs.length}</div>
                  <div className="hint">Demo records</div>
                </div>
                <div className="panel metric">
                  <div className="small">Open alerts</div>
                  <div className="value">
                    {db.alerts.filter((a) => a.status === "Open").length}
                  </div>
                  <div className="hint">Requires review</div>
                </div>
                <div className="panel metric">
                  <div className="small">Employees</div>
                  <div className="value">{db.employees.length}</div>
                  <div className="hint">Directory records</div>
                </div>
              </div>

              <div className="twocol">
                <div className="panel">
                  <div className="panelhead">
                    <h2>Alerts & follow-up</h2>
                  </div>
                  {db.alerts.map((a) => (
                    <div className="leader" key={a.id}>
                      <div className="grow">
                        <b>{a.type}</b>
                        <div className="small">{a.text}</div>
                      </div>
                      <span
                        className={`tag ${
                          a.status === "Open" ? "warn" : ""
                        }`}
                      >
                        {a.status}
                      </span>
                      {canEdit() && (
                        <button
                          className="btn secondary tiny"
                          onClick={() => toggleAlert(a.id)}
                        >
                          {a.status === "Open" ? "Resolve" : "Reopen"}
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit() && (
                    <div style={{ marginTop: "15px" }}>
                      <button
                        className="btn secondary tiny"
                        onClick={() => editRecordModal("alerts")}
                      >
                        Add alert
                      </button>
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panelhead">
                    <h2>Recent audit history</h2>
                  </div>
                  {db.audit.slice(0, 15).map((a) => (
                    <div className="leader" key={a.id}>
                      <div className="grow">
                        <b>{a.action}</b>
                        <div className="small">{a.details}</div>
                        <div className="small">
                          {a.at} · {a.actor}
                        </div>
                      </div>
                    </div>
                  ))}
                  {db.audit.length === 0 && (
                    <p>No changes recorded yet. Edit a record to see an audit event.</p>
                  )}
                </div>
              </div>

              <div className="panel section">
                <h2>Prototype tools</h2>
                <p style={{ margin: "10px 0" }}>
                  Export data as JSON, restore it later, or reset the sample database.
                </p>
                <div className="toolbar">
                  <button className="btn secondary" onClick={exportJSON}>
                    Export JSON backup
                  </button>
                  <label className="btn secondary" style={{ margin: 0, cursor: "pointer" }}>
                    Import JSON backup
                    <input
                      type="file"
                      accept="application/json"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          try {
                            const obj = JSON.parse(reader.result as string);
                            if (window.confirm("Replace current data with this backup?")) {
                              setDb(obj);
                            }
                          } catch (err: any) {
                            alert("Invalid backup: " + err.message);
                          }
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                  <button
                    className="btn danger"
                    onClick={() => {
                      if (window.confirm("Reload latest data from database?")) {
                        loadData();
                      }
                    }}
                  >
                    Reset demo data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Dialog */}
      {activeModal && (
        <div
          className="modalshade"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="modal">{activeModal}</div>
        </div>
      )}
    </div>
  );
}
