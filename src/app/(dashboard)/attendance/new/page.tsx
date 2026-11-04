import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createAttendance } from "../actions";

export default async function NewAttendancePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/attendance");

  const employees = await prisma.user.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/attendance" className="text-xs text-indigo-600 hover:underline">
          ← Back to Attendance
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Log Attendance</h1>
        <p className="text-sm text-slate-500">Record employee hours and presence status.</p>
      </div>

      <form action={createAttendance} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Employee</label>
          <select
            name="userId"
            required
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
            <input
              type="date"
              name="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hours Worked</label>
            <input
              type="number"
              name="hoursWorked"
              min="0"
              max="24"
              step="0.5"
              defaultValue={8}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
            <select
              name="status"
              defaultValue="present"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="present">Present</option>
              <option value="leave">Leave</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optional)</label>
          <input
            type="text"
            name="notes"
            placeholder="e.g. Approved sick leave"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">
          <Link
            href="/attendance"
            className="text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            Save Attendance
          </button>
        </div>
      </form>
    </div>
  );
}
