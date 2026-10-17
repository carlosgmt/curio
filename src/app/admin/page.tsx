"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminKpiCards } from "@/components/admin/AdminKpiCards";
import { GlobalCacheExplorer } from "@/components/admin/GlobalCacheExplorer";
import { TriageQueue } from "@/components/admin/TriageQueue";
import { ArchetypeDistribution } from "@/components/admin/ArchetypeDistribution";
import { apiFetch } from "@/lib/apiClient";
import type { CurioTelemetry } from "@/lib/system/telemetry";
import { ShieldAlert } from "lucide-react";

export default function AdminDashboardPage() {
  const [telemetry, setTelemetry] = useState<CurioTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/v1/system/telemetry");
      if (res.status === 401 || res.status === 403) {
        setAuthError("Unauthorized: Operator administrative privileges required.");
        setTelemetry(null);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        setAuthError(null);
      } else {
        console.error("Telemetry error:", await res.text());
      }
    } catch (err: any) {
      console.error("Telemetry fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Polling loop
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      fetchTelemetry();
    }, 10000);
    return () => clearInterval(interval);
  }, [isPolling, fetchTelemetry]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <AdminHeader
        telemetry={telemetry}
        isLoading={isLoading}
        isPolling={isPolling}
        onTogglePolling={() => setIsPolling(!isPolling)}
        onRefresh={fetchTelemetry}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {authError ? (
          <div className="p-8 rounded-xl border border-destructive/30 bg-destructive/10 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-xl font-serif font-medium text-foreground">Operator Access Required</h2>
            <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">
              {authError} Log in with an administrator account or provide the operator token.
            </p>
          </div>
        ) : (
          <>
            {/* KPI Overview Cards */}
            <AdminKpiCards telemetry={telemetry} />

            {/* Taste Graph Archetype Distribution */}
            <ArchetypeDistribution telemetry={telemetry} />

            {/* Ingestion Triage & Problem Console */}
            <TriageQueue />

            {/* Global Cache Explorer */}
            <GlobalCacheExplorer />
          </>
        )}
      </main>
    </div>
  );
}
