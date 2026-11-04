import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { updateEmployee } from "../../actions";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/employees");

  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) notFound();

  const [employee, teams] = await Promise.all([
    prisma.user.findUnique({ where: { id: numId } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!employee) notFound();

  const boundUpdate = updateEmployee.bind(null, numId);

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/employees" className="text-xs text-indigo-600 hover:underline">
          ← Back to Directory
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Edit Employee: {employee.name}</h1>
        <p className="text-sm text-slate-500">Update profile, role, or credentials.</p>
      </div>

      <form action={boundUpdate} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
            <input
              type="text"
              name="name"
              required
              defaultValue={employee.name}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">VSI Email</label>
            <input
              type="email"
              name="email"
              required
              defaultValue={employee.email}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role / Job Title</label>
            <input
              type="text"
              name="jobTitle"
              defaultValue={employee.jobTitle || ""}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Team</label>
            <select
              name="teamId"
              defaultValue={employee.teamId ?? ""}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No Team Assigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Access Role</label>
            <select
              name="role"
              defaultValue={employee.role}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Monthly Target</label>
            <input
              type="number"
              name="monthlyTarget"
              min="0"
              defaultValue={employee.monthlyTarget}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
            <select
              name="status"
              defaultValue={employee.status}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Reset Password <span className="font-normal text-slate-400">(leave blank to keep current)</span>
          </label>
          <input
            type="password"
            name="password"
            placeholder="New password (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">
          <Link
            href="/employees"
            className="text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
