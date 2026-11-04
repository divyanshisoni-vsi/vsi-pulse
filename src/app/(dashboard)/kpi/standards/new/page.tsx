import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createKpiStandard } from "../../actions";

export default async function NewKpiStandardPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/kpi");

  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/kpi" className="text-xs text-indigo-600 hover:underline">
          ← Back to KPI Standards
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">New KPI Standard</h1>
        <p className="text-sm text-slate-500">Define expected performance standards per team.</p>
      </div>

      <form action={createKpiStandard} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Team</label>
            <select
              name="teamId"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">KPI Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Product QA accuracy"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Target Value</label>
            <input
              type="number"
              name="targetValue"
              min="1"
              step="any"
              required
              defaultValue={30}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unit</label>
            <input
              type="text"
              name="unit"
              defaultValue="units"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Weight (%)</label>
            <input
              type="number"
              name="weightPercent"
              min="1"
              max="100"
              defaultValue={30}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description (optional)</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Measurement criteria or explanation..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">
          <Link
            href="/kpi"
            className="text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            Save KPI Standard
          </button>
        </div>
      </form>
    </div>
  );
}
