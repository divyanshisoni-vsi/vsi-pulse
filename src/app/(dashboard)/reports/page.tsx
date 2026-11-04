import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/utils";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const [auditLogs, alerts, logCount, employeeCount] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true } } },
    }),
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        relatedUser: { select: { name: true } },
        resolvedBy: { select: { name: true } },
      },
    }),
    prisma.dailyLog.count(),
    prisma.user.count({ where: { status: "active" } }),
  ]);

  const openAlerts = alerts.filter((a) => a.status === "open").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Reports & Audit</h1>
        <p className="text-sm text-slate-500 mt-0.5">System activity and alert management.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Audit events</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{auditLogs.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily logs</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{logCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Open alerts</p>
          <p className={`mt-2 text-3xl font-bold ${openAlerts > 0 ? "text-orange-600" : "text-slate-900"}`}>{openAlerts}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active employees</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{employeeCount}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">No alerts.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{a.type}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.message}</p>
                    {a.relatedUser && (
                      <p className="text-xs text-slate-400 mt-0.5">Re: {a.relatedUser.name}</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded flex-shrink-0 ${
                    a.status === "open" ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit log */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Recent audit history</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((a) => (
                <div key={a.id} className="py-2.5 border-b border-slate-100 last:border-0">
                  <p className="text-sm font-medium text-slate-800 capitalize">{a.action}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.actor?.name ?? a.actorEmail} · {formatDateTime(a.createdAt)}
                  </p>
                  {a.entityType && (
                    <p className="text-xs text-slate-400">
                      {a.entityType} #{a.entityId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
