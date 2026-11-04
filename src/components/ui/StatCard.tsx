type Props = {
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
};

export default function StatCard({ label, value, sub, warn }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${warn ? "text-orange-600" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
