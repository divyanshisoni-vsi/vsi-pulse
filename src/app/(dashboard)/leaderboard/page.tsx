import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { scorePercent } from "@/lib/utils";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const employees = await prisma.user.findMany({
    where: { status: "active" },
    include: {
      team: { select: { name: true } },
      dailyLogs: {
        where: { status: "verified" },
        select: { quantity: true },
      },
    },
  });

  const ranked = employees
    .map((e) => {
      const done = e.dailyLogs.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
      const pct = scorePercent(done, e.monthlyTarget);
      return { ...e, done, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const winner = ranked[0];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Leaderboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Monthly performance ranking.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-5">Company ranking</h2>
          {ranked.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {ranked.map((e, i) => (
                <div key={e.id} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                  <span className="w-6 text-sm font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {e.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{e.name}</p>
                      {i === 0 && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                          Top
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{e.team?.name ?? "—"} · {e.jobTitle ?? ""}</p>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-amber-400" : "bg-indigo-400"}`}
                        style={{ width: `${e.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 flex-shrink-0">{e.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {winner && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Current leader
            </p>
            <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 text-xl font-bold flex items-center justify-center mb-3">
              {winner.name[0]}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{winner.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{winner.team?.name}</p>
            <p className="text-2xl font-bold text-indigo-600 mt-3">{winner.pct}%</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {winner.done} / {winner.monthlyTarget} units verified
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
