"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  ListFilter,
  Palette,
  Bot,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Key,
  Smartphone,
  Info,
  Copy,
  FolderOpen,
  Sliders,
  Database,
} from "lucide-react";
import { useTheme, type ColorMode, type ColorPalette } from "@/lib/theme";
import { detectDeviceCapabilities, type DeviceAiCapabilities } from "@/lib/deviceIntelligence";
import { NewTypeDialog } from "@/components/shapeshift/NewTypeDialog";
import { cn } from "@/lib/utils";

type SettingsTab = "appearance" | "intelligence" | "types" | "lists";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const { mode, palette, setMode, setPalette } = useTheme();

  // API Key & Jev state
  const [jevInfo, setJevInfo] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [providerInput, setProviderInput] = useState<"typesafe" | "openrouter">("openrouter");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testingJev, setTestingJev] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Device AI capabilities
  const [deviceCaps, setDeviceCaps] = useState<DeviceAiCapabilities | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);

  // Types & Lists state
  const [types, setTypes] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState("Folder");

  const fetchSettings = () => {
    fetch("/api/v1/settings")
      .then((r) => r.json())
      .then((d) => {
        setJevInfo(d);
        if (d?.jev?.keySource?.includes("openrouter") || d?.jev?.provider === "openrouter") {
          setProviderInput("openrouter");
        }
      })
      .catch(() => {});
  };

  const fetchTypes = () => {
    fetch("/api/v1/types")
      .then((r) => r.json())
      .then((d) => setTypes(d))
      .catch(() => {});
  };

  const fetchLists = () => {
    fetch("/api/v1/lists")
      .then((r) => r.json())
      .then((d) => setLists(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetchSettings();
    fetchTypes();
    fetchLists();
    detectDeviceCapabilities().then(setDeviceCaps);
  }, []);

  const saveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch("/api/v1/settings/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKeyInput.trim(), provider: providerInput }),
      });
      if (res.ok) {
        setApiKeyInput("");
        fetchSettings();
        setTestResult({ success: true, message: "API key saved and applied successfully." });
      }
    } finally {
      setSavingKey(false);
    }
  };

  const removeApiKey = async () => {
    await fetch("/api/v1/settings/key", { method: "DELETE" });
    fetchSettings();
    setTestResult(null);
  };

  const testConnection = async () => {
    setTestingJev(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/settings/test-jev", { method: "POST" });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? "Connection operational" : "Connection failed"),
      });
    } catch {
      setTestResult({ success: false, message: "Network error connecting to API" });
    } finally {
      setTestingJev(false);
    }
  };

  const addList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    await fetch("/api/v1/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newListName.trim(), icon: newListIcon }),
    });
    setNewListName("");
    fetchLists();
  };

  const deleteList = async (id: string) => {
    await fetch(`/api/v1/lists/${id}`, { method: "DELETE" });
    fetchLists();
  };

  const deleteType = async (id: string) => {
    await fetch(`/api/v1/types/${id}`, { method: "DELETE" });
    fetchTypes();
  };

  const copyChromeFlag = (flag: string) => {
    navigator.clipboard.writeText(flag);
    setCopiedFlag(true);
    setTimeout(() => setCopiedFlag(false), 2000);
  };

  const palettes: Array<{ id: ColorPalette; name: string; color: string; desc: string }> = [
    { id: "indigo", name: "Indigo", color: "#4f46e5", desc: "Default calm electric blue" },
    { id: "emerald", name: "Emerald", color: "#059669", desc: "Clean nature green" },
    { id: "amber", name: "Amber", color: "#d97706", desc: "Warm energetic copper" },
    { id: "violet", name: "Violet", color: "#7c3aed", desc: "Deep rich royal purple" },
    { id: "rose", name: "Rose", color: "#e11d48", desc: "Modern ruby crimson" },
    { id: "slate", name: "Slate", color: "#475569", desc: "Subtle monochrome neutral" },
    { id: "dynamic", name: "Material You", color: "var(--brand, #4f46e5)", desc: "Android / Pixel device wallpaper accent" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-2xs hover:bg-secondary hover:text-foreground transition-all"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to BrainSpace</span>
          </Link>
          <div className="h-4 w-px bg-border/60" />
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      {/* Main Settings Content */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 md:flex-row">
        {/* Left Navigation Sidebar */}
        <aside className="w-full shrink-0 md:w-56">
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-start text-xs font-medium transition-all",
                activeTab === "appearance"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Palette className="size-4 shrink-0" />
              <span>Appearance & Theming</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("intelligence")}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-start text-xs font-medium transition-all",
                activeTab === "intelligence"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Bot className="size-4 shrink-0" />
              <span>AI & API Configuration</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("types")}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-start text-xs font-medium transition-all",
                activeTab === "types"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Sparkles className="size-4 shrink-0" />
              <span>Custom Card Types</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("lists")}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-start text-xs font-medium transition-all",
                activeTab === "lists"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <ListFilter className="size-4 shrink-0" />
              <span>Lists & Routing</span>
            </button>
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1">
          {/* ── 1. APPEARANCE & THEMING ── */}
          {activeTab === "appearance" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Appearance & Theming</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customize color modes, accent palettes, and device-adaptive Material You theming.
                </p>
              </div>

              {/* Color Mode Switcher */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Color Mode
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "dark", "system"] as ColorMode[]).map((m) => {
                    const isSelected = mode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs capitalize transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                            : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <span className="capitalize">{m}</span>
                        {isSelected && <span className="size-1 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Palette Switcher */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Accent Color Palette
                  </span>
                  <span className="text-xs font-medium text-primary capitalize">{palette}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {palettes.map((p) => {
                    const isSelected = palette === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPalette(p.id)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-xs transition-all text-start",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-2xs"
                            : "border-border bg-secondary/30 hover:bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="size-5 rounded-full shrink-0 flex items-center justify-center shadow-xs"
                            style={{ backgroundColor: p.color }}
                          >
                            {isSelected && <Check className="size-3 text-white" />}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{p.name}</span>
                            <span className="text-[11px] text-muted-foreground">{p.desc}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Sample */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Live Theme Preview
                </span>
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/50">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-2xs"
                  >
                    Active Button
                  </button>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Badge Tag
                  </span>
                  <input
                    type="text"
                    readOnly
                    value="Input focus ring preview"
                    className="rounded-lg border border-border bg-card px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 2. AI & INTELLIGENCE ── */}
          {activeTab === "intelligence" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">AI & Intelligence Engines</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure cloud models (OpenRouter, TypeSafe AI) or on-device intelligence (Pixel Gemini Nano).
                </p>
              </div>

              {/* 1. On-Device Intelligence Diagnostic Card (Pixel / Chrome) */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      On-Device Intelligence (Pixel / Chrome Built-in AI)
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
                      deviceCaps?.geminiNano === "readily" || deviceCaps?.geminiNano === "available"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {deviceCaps?.geminiNano === "readily"
                      ? "Ready on Device"
                      : deviceCaps?.geminiNano === "available"
                      ? "Available"
                      : "Flag Setup Required"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  BrainSpace can run intent classification and summaries directly on your Pixel's Gemini Nano hardware with zero cloud latency and total privacy.
                </p>

                {/* Explanation for why window.ai is not detected by default on Pixel 10 */}
                <div className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-3.5 border border-border/60 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="size-4 text-primary shrink-0" />
                    <span>Why is Gemini Nano not detected by default on Pixel 10?</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Google ships Gemini Nano in Chrome for Android, but disables the developer Prompt API (`window.ai`) by default unless experimental flags are toggled:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground ps-1 pt-1 font-mono text-[11px]">
                    <li>Open Chrome on Pixel and enter: <span className="text-foreground">chrome://flags</span></li>
                    <li>Search for and enable: <span className="text-primary font-semibold">#prompt-api-for-gemini-nano</span></li>
                    <li>Search for and enable: <span className="text-primary font-semibold">#optimization-guide-on-device-model</span> (set to "Enabled BypassPerfRequirement")</li>
                    <li>Relaunch Chrome. BrainSpace will automatically detect Gemini Nano!</li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => copyChromeFlag("chrome://flags/#prompt-api-for-gemini-nano")}
                    className="inline-flex items-center gap-1.5 self-start mt-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Copy className="size-3" />
                    <span>{copiedFlag ? "Flag URL copied!" : "Copy Chrome Flag URL"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                  <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-secondary/30">
                    <span className="text-muted-foreground font-medium text-[11px]">Gemini Nano (window.ai)</span>
                    <span className="font-semibold text-foreground">
                      {deviceCaps?.geminiNano === "readily"
                        ? "Active & Ready"
                        : deviceCaps?.geminiNano === "available"
                        ? "Model Available"
                        : "Experimental Flag Required"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-secondary/30">
                    <span className="text-muted-foreground font-medium text-[11px]">On-Device Voice Dictation</span>
                    <span className="font-semibold text-emerald-600">
                      {deviceCaps?.speechRecognition ? (deviceCaps?.isPixelOrAndroid ? "Pixel Native Voice Engine" : "Browser Ready") : "Unavailable"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Cloud AI & API Key (OpenRouter / TypeSafe) */}
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="size-4.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Cloud Intelligence Provider</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
                      jevInfo?.jev?.hasKey
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {jevInfo?.jev?.hasKey ? "Key Configured" : "Offline Fallback"}
                  </span>
                </div>

                {/* Provider Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProviderInput("openrouter")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-xl border text-xs text-start transition-all",
                      providerInput === "openrouter"
                        ? "border-primary bg-primary/10 shadow-2xs font-semibold"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <span className="font-semibold text-foreground">OpenRouter</span>
                    <span className="text-[11px] text-muted-foreground">Gemini Flash, Claude, Llama 3 (sk-or-v1-...)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProviderInput("typesafe")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-xl border text-xs text-start transition-all",
                      providerInput === "typesafe"
                        ? "border-primary bg-primary/10 shadow-2xs font-semibold"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <span className="font-semibold text-foreground">TypeSafe AI (Jev)</span>
                    <span className="text-[11px] text-muted-foreground">Deterministic intent classifier model</span>
                  </button>
                </div>

                {/* API Key Form */}
                <form onSubmit={saveApiKey} className="flex flex-col gap-3">
                  <div className="relative flex items-center">
                    <input
                      type={showApiKey ? "text" : "password"}
                      placeholder={
                        providerInput === "openrouter"
                          ? "Enter OpenRouter API key (sk-or-v1-...)"
                          : "Enter TypeSafe API key (sk-...)"
                      }
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="w-full rounded-xl border border-border bg-secondary/40 py-2 ps-3.5 pe-10 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute end-2.5 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {jevInfo?.jev?.keySource ? `Key active from: ${jevInfo.jev.keySource}` : "Using instant offline classifier"}
                    </span>
                    <div className="flex items-center gap-2">
                      {jevInfo?.jev?.hasKey && (
                        <button
                          type="button"
                          onClick={removeApiKey}
                          className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-secondary transition-all"
                        >
                          Remove Key
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={savingKey || !apiKeyInput.trim()}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-2xs"
                      >
                        {savingKey ? "Saving..." : "Save Key"}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Connection Ping Test */}
                <div className="mt-2 pt-3 border-t border-border/40 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={testingJev}
                    className="flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-all"
                  >
                    {testingJev ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <span>Test Live Ping</span>
                    )}
                  </button>

                  {testResult && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          <span className="text-emerald-600 font-medium">Connected</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-4 text-destructive" />
                          <span className="text-destructive font-medium">Failed</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {testResult && (
                  <p className="text-xs text-muted-foreground bg-secondary/40 p-3 rounded-xl">
                    {testResult.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── 3. CUSTOM CARD TYPES ── */}
          {activeTab === "types" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Custom Card Types</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define custom card schemas, field types, and keyword detection patterns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewTypeOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 shadow-2xs transition-all"
                >
                  <Plus className="size-3.5" />
                  <span>New Custom Type</span>
                </button>
              </div>

              {types.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-border text-center">
                  <Sparkles className="size-8 text-muted-foreground/60 mb-2" />
                  <span className="text-sm font-medium text-foreground">No Custom Types Yet</span>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Create custom types here or type inline: <br />
                    <code className="text-primary font-mono text-[11px] bg-secondary/60 px-1.5 py-0.5 rounded">new type: Wine (vintage, rating)</code>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {types.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-2xs"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">{t.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{t.fields?.length || 0} fields</span>
                          <span>•</span>
                          <span>{t.patterns?.length || 0} patterns</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteType(t.id)}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-all"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 4. LISTS & ROUTING ── */}
          {activeTab === "lists" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Lists & Organization</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage lists and categories. Cards can auto-route to lists via smart input.
                </p>
              </div>

              {/* Add List Form */}
              <form onSubmit={addList} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New list name (e.g. Travel, Health, Books)..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-card px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-2xs transition-all"
                >
                  Add List
                </button>
              </form>

              {/* Lists Collection */}
              <div className="flex flex-col gap-2.5">
                {lists.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderOpen className="size-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{l.name}</span>
                      {l.isDefault ? (
                        <span className="rounded bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground">
                          Default
                        </span>
                      ) : null}
                    </div>
                    {!l.isDefault && (
                      <button
                        type="button"
                        onClick={() => deleteList(l.id)}
                        className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-all"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <NewTypeDialog
        open={newTypeOpen}
        onOpenChange={setNewTypeOpen}
        onCreated={() => fetchTypes()}
      />
    </div>
  );
}
