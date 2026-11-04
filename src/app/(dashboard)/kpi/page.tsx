import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { scorePercent } from "@/lib/utils";

export default async function KpiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const userId = parseInt(session.user.id);
  const teamId = session.user.teamId ? parseInt(session.user.teamId) : null;

  const where =
    role === "employee"
      ? { id: userId, status: "active" as const }
      : role === "manager" && teamId
      ? { teamId, status: "active" as const }
      : { status: "active" as const };

  const employees = await prisma.user.findMany({
    where,
    include: {
      team: { select: { name: true } },
      dailyLogs: {
        where: { status: "verified" },
        select: { quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const kpiStandards = await prisma.kpiStandard.findMany({
    include: { team: { select: { name: true } } },
    orderBy: { team: { name: "asc" } },
  });

  const withScores = employees.map((e) => {
    const done = e.dailyLogs.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
    const pct = scorePercent(done, e.monthlyTarget);
    return { ...e, done, pct };
  });

  const avg =
    withScores.length > 0
      ? Math.round(withScores.reduce((a, e) => a + e.pct, 0) / withScores.length)
      : 0;

  const onTrack = withScores.filter((e) => e.pct >= 75).length;
  const below = withScores.filter((e) => e.pct < 40).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">KPI & Performance</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Verified work units against monthly targets.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg achievement</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{avg}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">KPI standards</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{kpiStandards.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">On track ≥75%</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{onTrack}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Below standard</p>
          <p className={`mt-2 text-3xl font-bold ${below > 0 ? "text-red-600" : "text-slate-900"}`}>{below}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Employee progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-5">Employee progress</h2>
          {withScores.length === 0 ? (
            <p className="text-sm text-slate-400">No employees.</p>
          ) : (
            <div className="space-y-5">
              {[...withScores].sort((a, b) => b.pct - a.pct).map((e) => (
                <div key={e.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{e.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{e.team?.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      {e.done} / {e.monthlyTarget} · {e.pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        e.pct >= 75 ? "bg-emerald-500" : e.pct >= 40 ? "bg-amber-500" : "bg-red-400"
                      }`}
                      style={{ width: `${e.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPI standards */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-800">KPI standards</h2>
            {role === "admin" && (
              <a href="/kpi/standards/new" className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                + Add standard
              </a>
            )}
          </div>
          {kpiStandards.length === 0 ? (
            <p className="text-sm text-slate-400">No KPI standards defined yet.</p>
          ) : (
            <div className="space-y-3">
              {kpiStandards.map((k) => (
                <div key={k.id} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{k.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {k.team.name} · Target {Number(k.targetValue)} {k.unit} · Weight {k.weightPercent}%
                    </p>
                    {k.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{k.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
