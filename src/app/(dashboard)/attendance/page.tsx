import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700",
  leave: "bg-amber-50 text-amber-700",
  absent: "bg-red-50 text-red-700",
  half_day: "bg-blue-50 text-blue-700",
};

export default async function AttendancePage() {
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

  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
    include: { user: { select: { name: true, team: { select: { name: true } } } } },
    take: 100,
  });

  const present = records.filter((r) => r.status === "present").length;
  const onLeave = records.filter((r) => r.status === "leave").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const totalHours = records.reduce((acc, r) => acc + Number(r.hoursWorked), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Working hours and leave records.</p>
        </div>
        {role === "admin" && (
          <a
            href="/attendance/new"
            className="text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            + Add record
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Present</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{present}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">On leave</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{onLeave}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Absent</p>
          <p className={`mt-2 text-3xl font-bold ${absent > 0 ? "text-red-600" : "text-slate-900"}`}>{absent}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total hours</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{totalHours.toFixed(1)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No attendance records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Employee</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Hours</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.user.name}</p>
                      <p className="text-xs text-slate-400">{r.user.team?.name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{Number(r.hoursWorked)}h</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${statusColors[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{r.source}</td>
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
