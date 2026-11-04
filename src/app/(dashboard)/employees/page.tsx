import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "manager"].includes(session.user.role)) redirect("/dashboard");

  const role = session.user.role;
  const teamId = session.user.teamId ? parseInt(session.user.teamId) : null;

  const employees = await prisma.user.findMany({
    where: role === "manager" && teamId ? { teamId } : {},
    orderBy: { name: "asc" },
    include: { team: { select: { name: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employee Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">People, teams, and targets.</p>
        </div>
        {role === "admin" && (
          <a
            href="/employees/new"
            className="text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            + Add employee
          </a>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No employees yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Name</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Role</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Team</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Monthly target</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Access</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Status</th>
                  {role === "admin" && (
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {e.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{e.name}</p>
                          <p className="text-xs text-slate-400">{e.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.jobTitle ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{e.team?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{e.monthlyTarget}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold capitalize px-2 py-1 rounded bg-slate-100 text-slate-600">
                        {e.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${e.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {e.status}
                      </span>
                    </td>
                    {role === "admin" && (
                      <td className="px-4 py-3">
                        <a
                          href={`/employees/${e.id}/edit`}
                          className="text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                        >
                          Edit
                        </a>
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
  );
}
