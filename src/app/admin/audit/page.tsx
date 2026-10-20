"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, RefreshCw, Filter, Clock, User, Activity } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = filterAction
        ? `/api/v1/system/audit?action=${encodeURIComponent(filterAction)}`
        : "/api/v1/system/audit";
      const res = await apiFetch(url);
      const data = await res.json();
      if (res.ok && data?.logs) {
        setLogs(data.logs);
        setError(null);
      } else {
        setError(data?.error || "Failed to load audit logs");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Title */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-5">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 transition-colors text-stone-400 hover:text-stone-100"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h1 className="text-xl font-serif font-bold tracking-tight">
                  Operator Audit Logs
                </h1>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Immutable record of administrative mutations, commerce events, and cache operations.
              </p>
            </div>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs text-stone-300 inline-flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-stone-900/60 border border-stone-800 px-3 py-1.5 rounded-xl text-xs text-stone-300">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Filter by action (e.g. COMMERCE_OUTBOUND_CLICK)"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-transparent border-none outline-none text-xs placeholder-stone-500 w-64"
            />
          </div>
          {filterAction && (
            <button
              onClick={() => setFilterAction("")}
              className="text-xs text-stone-500 hover:text-stone-300 underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Audit Log Table */}
        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target ID</th>
                  <th className="py-3 px-4">Metadata</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-sans">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-500">
                      {loading ? "Loading audit logs..." : "No audit log events found."}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-400 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3 h-3 text-stone-500" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3 h-3 text-stone-500" />
                          <span className="font-medium text-stone-200">
                            @{log.operator?.username || "system"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-400 truncate max-w-[140px]">
                        {log.targetEntityId || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-stone-400 truncate max-w-[240px]">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500 text-[11px] whitespace-nowrap">
                        {log.ipAddress || "127.0.0.1"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
