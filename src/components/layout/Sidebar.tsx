"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "▣", roles: ["admin", "manager", "employee"] },
  { label: "Daily Logs", href: "/logs", icon: "≡", roles: ["admin", "manager", "employee"] },
  { label: "KPI & Performance", href: "/kpi", icon: "◎", roles: ["admin", "manager", "employee"] },
  { label: "Employees", href: "/employees", icon: "♙", roles: ["admin", "manager"] },
  { label: "Attendance", href: "/attendance", icon: "▦", roles: ["admin", "manager", "employee"] },
  { label: "Leaderboard", href: "/leaderboard", icon: "★", roles: ["admin", "manager", "employee"] },
  { label: "Reports", href: "/reports", icon: "▥", roles: ["admin"] },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const visible = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 sticky top-0 h-screen">
      <div className="px-6 py-5 border-b border-slate-800">
        <span className="text-white font-bold text-lg tracking-tight">
          VSI<span className="text-indigo-400">Pulse</span>
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-2">
          Workspace
        </p>
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">Virtual Solutions India</p>
      </div>
    </aside>
  );
}
