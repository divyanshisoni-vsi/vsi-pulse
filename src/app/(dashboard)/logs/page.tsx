import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import AddLogButton from "./AddLogButton";
import LogActions from "./LogActions";

const statusColors: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  needs_clarification: "bg-orange-50 text-orange-700",
  rejected: "bg-red-50 text-red-700",
};

export default async function LogsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const userId = parseInt(session.user.id);
  const teamId = session.user.teamId ? parseInt(session.user.teamId) : null;

  const where =
    role === "employee"
      ? { userId }
      : role === "manager" && teamId
      ? { user: { teamId } }
      : {};

  const logs = await prisma.dailyLog.findMany({
    where,
    orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, team: { select: { name: true } } } },
      verifier: { select: { name: true } },
    },
  });

  const canAdd = role === "admin" || role === "manager" || role === "employee";
  const canVerify = role === "admin" || role === "manager";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daily Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Work records with verification tracking.
          </p>
        </div>
        {canAdd && <AddLogButton role={role} userId={userId} />}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No logs yet. Add the first daily log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Employee</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Activity</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Units</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Source</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(log.logDate)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{log.user.name}</p>
                      <p className="text-xs text-slate-400">{log.user.team?.name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-700 line-clamp-2">{log.activity}</p>
                      {log.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{log.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {log.quantity != null ? Number(log.quantity) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">
                      {log.source}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-md ${statusColors[log.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {log.status.replace(/_/g, " ")}
                      </span>
                      {log.verifier && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          by {log.verifier.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LogActions
                        logId={log.id}
                        status={log.status}
                        canVerify={canVerify}
                        canEdit={
                          role === "admin" ||
                          (role === "manager") ||
                          (role === "employee" && log.userId === userId && log.status === "pending")
                        }
                        canDelete={role === "admin"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
