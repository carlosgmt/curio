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

  // OpenRouter & AI state
  const [openRouterInfo, setOpenRouterInfo] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-001");
  const [customModelInput, setCustomModelInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
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
        setOpenRouterInfo(d?.openrouter || d?.jev || null);
        if (d?.openrouter?.model) {
          setSelectedModel(d.openrouter.model);
        }
      })
      .catch(() => {});
  };

  const fetchTypes = () => {
    fetch("/api/v1/types")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setTypes(d);
        } else if (d && typeof d === "object") {
          setTypes(Array.isArray(d.customs) ? d.customs : []);
        } else {
          setTypes([]);
        }
      })
      .catch(() => {
        setTypes([]);
      });
  };

  const fetchLists = () => {
    fetch("/api/v1/lists")
      .then((r) => r.json())
      .then((d) => setLists(Array.isArray(d) ? d : []))
      .catch(() => setLists([]));
  };

  useEffect(() => {
    fetchSettings();
    fetchTypes();
    fetchLists();
    detectDeviceCapabilities().then(setDeviceCaps);
  }, []);

  const saveOpenRouterConfig = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSavingKey(true);
    try {
      const modelToSave = selectedModel === "custom" ? customModelInput.trim() : selectedModel;
      const keyToSend = apiKeyInput.trim() || "KEEP_EXISTING_KEY";
      const res = await fetch("/api/v1/settings/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyToSend, model: modelToSave }),
      });
      if (res.ok) {
        setApiKeyInput("");
        fetchSettings();
        setTestResult({
          success: true,
          message: `Configuration saved (Model: ${modelToSave}).`,
        });
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
    setTestingAi(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/settings/test-jev", { method: "POST" });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? "OpenRouter connected successfully" : "Connection failed"),
      });
    } catch {
      setTestResult({ success: false, message: "Network error connecting to OpenRouter" });
    } finally {
      setTestingAi(false);
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
    { id: "dynamic", name: "Material You (Dynamic)", color: "AccentColor", desc: "Native Pixel & Android wallpaper system accent color (Recommended)" },
    { id: "indigo", name: "Indigo", color: "#4f46e5", desc: "Default calm electric blue" },
    { id: "emerald", name: "Emerald", color: "#059669", desc: "Clean nature green" },
    { id: "amber", name: "Amber", color: "#d97706", desc: "Warm energetic copper" },
    { id: "violet", name: "Violet", color: "#7c3aed", desc: "Deep rich royal purple" },
    { id: "rose", name: "Rose", color: "#e11d48", desc: "Modern ruby crimson" },
    { id: "slate", name: "Slate", color: "#475569", desc: "Subtle monochrome neutral" },
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
                  Configure cloud models via OpenRouter or check on-device Pixel hardware capabilities.
                </p>
              </div>

              {/* 1. Cloud AI & API Key (OpenRouter Exclusive) */}
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="size-4.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">OpenRouter Cloud Intelligence</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
                      openRouterInfo?.hasKey
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {openRouterInfo?.hasKey ? `Online (${openRouterInfo.model})` : "Offline (Local Heuristic)"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  BrainSpace uses OpenRouter for intent classification and card structuring. Select your preferred model and enter your key below.
                </p>

                {/* Model Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-foreground">Selected Model</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", desc: "Fastest response & economical (Recommended)" },
                      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", desc: "High performance open-weights workhorse" },
                      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", desc: "Advanced reasoning & knowledge" },
                      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", desc: "Highest instruction adherence" },
                      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast & concise compact model" },
                      { id: "custom", name: "Custom Model", desc: "Specify any OpenRouter model identifier" },
                    ].map((m) => {
                      const isSelected = selectedModel === m.id || (m.id === "custom" && !["google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat", "anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini"].includes(selectedModel));
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (m.id === "custom") {
                              setSelectedModel("custom");
                            } else {
                              setSelectedModel(m.id);
                            }
                          }}
                          className={cn(
                            "flex flex-col items-start gap-1 p-3 rounded-xl border text-xs text-start transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-2xs font-semibold"
                              : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-foreground">{m.name}</span>
                            {isSelected && <Check className="size-3.5 text-primary" />}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{m.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Model Input */}
                  {(selectedModel === "custom" || !["google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat", "anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini"].includes(selectedModel)) && (
                    <div className="mt-1 flex flex-col gap-1">
                      <label className="text-[11px] text-muted-foreground">Custom OpenRouter Model Identifier</label>
                      <input
                        type="text"
                        placeholder="e.g. mistralai/mistral-large-2411 or qwen/qwen-2.5-72b-instruct"
                        value={customModelInput || (selectedModel !== "custom" ? selectedModel : "")}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        className="w-full rounded-xl border border-border bg-secondary/40 py-2 px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  )}
                </div>

                {/* API Key Form */}
                <form onSubmit={saveOpenRouterConfig} className="flex flex-col gap-3 mt-1">
                  <label className="text-xs font-semibold text-foreground">OpenRouter API Key</label>
                  <div className="relative flex items-center">
                    <input
                      type={showApiKey ? "text" : "password"}
                      placeholder={openRouterInfo?.hasKey ? "Key configured (enter new key to replace)" : "Enter OpenRouter API key (sk-or-v1-...)"}
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
                      {openRouterInfo?.keySource ? `Key stored via ${openRouterInfo.keySource}` : "Using local offline heuristic engine"}
                    </span>
                    <div className="flex items-center gap-2">
                      {openRouterInfo?.hasKey && (
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
                        disabled={savingKey}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-2xs"
                      >
                        {savingKey ? "Saving..." : "Save Configuration"}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Connection Ping Test */}
                <div className="mt-2 pt-3 border-t border-border/40 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={testingAi}
                    className="flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-all"
                  >
                    {testingAi ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Testing OpenRouter...</span>
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
                          <span className="text-emerald-600 font-medium">Validated</span>
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

              {/* 2. On-Device Intelligence Diagnostic Card (Pixel / Chrome) */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      On-Device Capabilities (Pixel 10 / Chrome)
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
                      deviceCaps?.speechRecognition
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {deviceCaps?.speechRecognition ? "Voice Dictation Active" : "Standard Web"}
                  </span>
                </div>

                {/* Explanation for why window.ai is not in Chrome Stable */}
                <div className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-3.5 border border-border/60 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="size-4 text-primary shrink-0" />
                    <span>Why don't the Prompt API flags appear in Chrome on your phone?</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Google ships Gemini Nano hardware acceleration on Pixel, but the developer Prompt API (<code className="text-primary font-mono text-[11px]">window.ai</code>) is currently an experimental preview restricted to <strong>Chrome Dev / Canary</strong> builds and Desktop Origin Trials. Standard <strong>Chrome Stable</strong> on Android does not expose those flags yet.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Your on-device <strong>Speech Dictation Engine</strong> works natively directly through Pixel hardware with instant speech-to-text. For card categorization, BrainSpace uses the ultra-fast local heuristic classifier (0.1ms) or your selected OpenRouter model above.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                  <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-secondary/30">
                    <span className="text-muted-foreground font-medium text-[11px]">Pixel Native Voice Engine</span>
                    <span className="font-semibold text-emerald-600">
                      {deviceCaps?.speechRecognition ? "Ready (Tap Mic on Input)" : "Browser Dictation"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-secondary/30">
                    <span className="text-muted-foreground font-medium text-[11px]">Gemini Nano (window.ai)</span>
                    <span className="font-semibold text-muted-foreground">
                      Requires Chrome Dev/Canary Preview
                    </span>
                  </div>
                </div>
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
