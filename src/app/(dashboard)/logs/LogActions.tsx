"use client";

import { updateLogStatus, deleteLog } from "./actions";
import { useState } from "react";

type Props = {
  logId: number;
  status: string;
  canVerify: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export default function LogActions({ logId, status, canVerify, canEdit, canDelete }: Props) {
  const [loading, setLoading] = useState(false);

  async function act(fn: () => Promise<void>) {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  }

  if (!canVerify && !canEdit && !canDelete) return <span className="text-xs text-slate-400">—</span>;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {canVerify && status !== "verified" && (
        <button
          disabled={loading}
          onClick={() => act(() => updateLogStatus(logId, "verified"))}
          className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
        >
          Verify
        </button>
      )}
      {canVerify && status === "pending" && (
        <button
          disabled={loading}
          onClick={() => act(() => updateLogStatus(logId, "needs_clarification"))}
          className="text-xs font-medium px-2.5 py-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 transition disabled:opacity-50"
        >
          Clarify
        </button>
      )}
      {canDelete && (
        <button
          disabled={loading}
          onClick={() => {
            if (confirm("Delete this log? This cannot be undone."))
              act(() => deleteLog(logId));
          }}
          className="text-xs font-medium px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}
