"use client";

import { signOut } from "next-auth/react";

type Props = {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

export default function TopBar({ user }: Props) {
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 capitalize">
          {user.role}
        </span>
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
          {initials}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-slate-500 hover:text-slate-800 transition font-medium"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
