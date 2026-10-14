"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Sparkles,
  List as ListIcon,
  Palette,
  Cpu,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  Monitor,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useTheme, type ColorMode, type ColorPalette } from "@/lib/theme";
import { NewTypeDialog } from "./NewTypeDialog";
import { notify } from "@/lib/notify";
import { detectDeviceCapabilities, type DeviceAiCapabilities } from "@/lib/deviceIntelligence";
import { Key, Eye, EyeOff, Smartphone, Mic } from "lucide-react";
import { CARD_INTENTS, registry } from "@/components/intents/registry";

const PALETTES: { id: ColorPalette; name: string; color: string }[] = [
  { id: "indigo", name: "Indigo", color: "#3b5bdb" },
  { id: "emerald", name: "Emerald", color: "#059669" },
  { id: "amber", name: "Amber", color: "#d97706" },
  { id: "violet", name: "Violet", color: "#7c3aed" },
  { id: "rose", name: "Rose", color: "#e11d48" },
  { id: "slate", name: "Slate", color: "#475569" },
];

export function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"types" | "lists" | "theme" | "jev">("types");
  const { mode, palette, setMode, setPalette } = useTheme();

  // Types state
  const [typesData, setTypesData] = useState<{ builtins: string[]; customs: any[] }>({
    builtins: [],
    customs: [],
  });
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [builtInSearch, setBuiltInSearch] = useState("");

  // Lists state
  const [listsData, setListsData] = useState<any[]>([]);
  const [newListName, setNewListName] = useState("");

  // Jev state
  const [jevInfo, setJevInfo] = useState<any>(null);
  const [testingJev, setTestingJev] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchTypes = () => {
    fetch("/api/v1/types")
      .then((r) => r.json())
      .then((d) => setTypesData(d))
      .catch(() => {});
  };

  const fetchLists = () => {
    fetch("/api/v1/lists")
      .then((r) => r.json())
      .then((d) => setListsData(d))
      .catch(() => {});
  };

  const fetchSettings = () => {
    fetch("/api/v1/settings")
      .then((r) => r.json())
      .then((d) => setJevInfo(d))
      .catch(() => {});
  };

  useEffect(() => {
    if (open) {
      fetchTypes();
      fetchLists();
      fetchSettings();
    }
  }, [open]);

  const deleteCustomType = async (id: string) => {
    try {
      await fetch(`/api/v1/types/${id}`, { method: "DELETE" });
      notify("Custom type deleted", { id: "type-deleted" });
      fetchTypes();
    } catch {}
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const res = await fetch("/api/v1/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (res.ok) {
        setNewListName("");
        fetchLists();
        notify("List created", { id: "list-created" });
      }
    } catch {}
  };

  const deleteList = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/lists/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchLists();
        notify("List deleted (cards moved to Inbox)", { id: "list-deleted" });
      }
    } catch {}
  };

  const moveListOrder = async (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= listsData.length) return;

    const current = listsData[index];
    const target = listsData[targetIdx];

    try {
      await Promise.all([
        fetch(`/api/v1/lists/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: target.sortOrder }),
        }),
        fetch(`/api/v1/lists/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: current.sortOrder }),
        }),
      ]);
      fetchLists();
    } catch {}
  };

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [deviceCaps, setDeviceCaps] = useState<DeviceAiCapabilities | null>(null);

  useEffect(() => {
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
        body: JSON.stringify({ key: apiKeyInput.trim() }),
      });
      if (res.ok) {
        setApiKeyInput("");
        fetchSettings();
        notify("TypeSafe API Key saved", { id: "key-saved" });
      } else {
        notify("Failed to save key", { id: "key-err" });
      }
    } catch {
      notify("Offline: failed to save key", { id: "key-err" });
    } finally {
      setSavingKey(false);
    }
  };

  const removeApiKey = async () => {
    try {
      await fetch("/api/v1/settings/key", { method: "DELETE" });
      fetchSettings();
      notify("TypeSafe API Key removed", { id: "key-removed" });
    } catch {}
  };

  const testJevConnection = async () => {
    setTestingJev(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/settings/test-jev", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection failed" });
    } finally {
      setTestingJev(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <div className="flex items-center gap-2 border-b border-border/50 px-6 py-4 bg-secondary/30">
            <Settings className="size-4.5 text-primary" />
            <DialogTitle className="text-base font-semibold">Curio Settings</DialogTitle>
          </div>

          {/* Tabs header */}
          <div className="flex border-b border-border/50 bg-secondary/15 px-6 gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("types")}
              className={`flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === "types"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>Card Types</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("lists")}
              className={`flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === "lists"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListIcon className="size-3.5" />
              <span>Lists & Routing</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("theme")}
              className={`flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === "theme"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Palette className="size-3.5" />
              <span>Themes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("jev")}
              className={`flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === "jev"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="size-3.5" />
              <span>Jev AI</span>
            </button>
          </div>

          {/* Tab content body */}
          <div className="p-6 overflow-y-auto flex-1 min-h-[340px]">
            {/* ── 1. TYPES TAB ── */}
            {activeTab === "types" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Custom Card Schemas</h3>
                    <p className="text-xs text-muted-foreground">
                      Define new card structures with custom fields.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewTypeOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 shadow-2xs"
                  >
                    <Plus className="size-3.5" />
                    <span>New Type</span>
                  </button>
                </div>

                {/* Custom types list */}
                {typesData.customs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground bg-secondary/30 rounded-xl border border-dashed border-border/80">
                    No custom types yet. Click "New Type" or type "new type: Wine (vintage, rating)" in the input!
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {typesData.customs.map((ct) => (
                      <div
                        key={ct.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-2xs"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">{ct.name}</span>
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                              {ct.id}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ct.fields.map((f: any, idx: number) => (
                              <span
                                key={idx}
                                className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {f.label} ({f.kind})
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteCustomType(ct.id)}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-secondary"
                          title="Delete custom type"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-border/40 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" />
                        <span>Existing Standard Types ({CARD_INTENTS.length})</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Built-in card models ready out of the box.
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder="Filter types..."
                      value={builtInSearch}
                      onChange={(e) => setBuiltInSearch(e.target.value)}
                      className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring w-36"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
                    {CARD_INTENTS.filter((k) => {
                      const def = registry[k];
                      if (!builtInSearch.trim()) return true;
                      const q = builtInSearch.toLowerCase();
                      return (
                        def.label.toLowerCase().includes(q) ||
                        k.toLowerCase().includes(q) ||
                        (def.description && def.description.toLowerCase().includes(q)) ||
                        def.example.toLowerCase().includes(q)
                      );
                    }).map((k) => {
                      const def = registry[k];
                      const Icon = def.icon;
                      return (
                        <div
                          key={k}
                          className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-secondary/20 p-2.5 text-xs hover:border-border transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid size-6 shrink-0 place-items-center rounded bg-secondary text-foreground border border-border/40">
                              <Icon className="size-3.5" />
                            </span>
                            <span className="font-semibold text-foreground text-xs">{def.label}</span>
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.2 rounded font-mono ml-auto">
                              {k}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {def.description || "Intelligent card type"}
                          </p>
                          <div className="text-[10px] font-mono text-muted-foreground/80 truncate bg-background/60 px-2 py-0.5 rounded border border-border/30 mt-0.5">
                            <span className="text-primary/70 mr-1 select-none">ex:</span>
                            {def.example}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. LISTS TAB ── */}
            {activeTab === "lists" && (
              <div className="flex flex-col gap-4">
                <form onSubmit={createList} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add new list name (e.g. Health, Projects)"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={!newListName.trim()}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    <span>Add List</span>
                  </button>
                </form>

                <div className="flex flex-col gap-2 mt-2">
                  {listsData.map((l, idx) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveListOrder(idx, "up")}
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === listsData.length - 1}
                            onClick={() => moveListOrder(idx, "down")}
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                        <span className="font-medium text-xs text-foreground">{l.name}</span>
                        {l.isDefault && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold uppercase">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {l.cardCount ?? 0} cards
                        </span>
                        {!l.isDefault && (
                          <button
                            type="button"
                            onClick={() => deleteList(l.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-secondary"
                            title="Delete list"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. THEMES TAB ── */}
            {activeTab === "theme" && (
              <div className="flex flex-col gap-6">
                {/* Mode */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-foreground">Appearance Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("light")}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-xs font-medium transition-all ${
                        mode === "light"
                          ? "border-primary bg-primary/5 text-primary shadow-xs"
                          : "border-border hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <Sun className="size-5" />
                      <span>Light</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("dark")}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-xs font-medium transition-all ${
                        mode === "dark"
                          ? "border-primary bg-primary/5 text-primary shadow-xs"
                          : "border-border hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <Moon className="size-5" />
                      <span>Dark</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("system")}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-xs font-medium transition-all ${
                        mode === "system"
                          ? "border-primary bg-primary/5 text-primary shadow-xs"
                          : "border-border hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <Monitor className="size-5" />
                      <span>System</span>
                    </button>
                  </div>
                </div>

                {/* Accent palette */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                  <label className="text-xs font-semibold text-foreground">Accent Color Palette</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {PALETTES.map((p) => {
                      const isSelected = palette === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPalette(p.id)}
                          className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-2xs font-semibold"
                              : "border-border hover:bg-secondary/40 text-muted-foreground"
                          }`}
                        >
                          <span
                            className="size-4.5 rounded-full shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: p.color }}
                          >
                            {isSelected && <Check className="size-3 text-white" />}
                          </span>
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── 4. JEV / AI TAB ── */}
            {activeTab === "jev" && (
              <div className="flex flex-col gap-5">
                {/* 1. Device Intelligence (Pixel / Chrome Built-in AI) */}
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">On-Device Intelligence (Pixel / Chrome)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Curio can utilize in-browser AI running directly on your hardware without sending notes to the cloud.
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/40 text-xs">
                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30">
                      <span className="text-muted-foreground font-medium">Gemini Nano (window.ai)</span>
                      <span className={`font-semibold ${
                        deviceCaps?.geminiNano === "readily" || deviceCaps?.geminiNano === "available"
                          ? "text-emerald-600"
                          : "text-muted-foreground/70"
                      }`}>
                        {deviceCaps?.geminiNano === "readily"
                          ? "Ready on Device"
                          : deviceCaps?.geminiNano === "downloading"
                          ? "Downloading Model"
                          : deviceCaps?.geminiNano === "available"
                          ? "Available"
                          : "Not detected"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30">
                      <span className="text-muted-foreground font-medium">On-Device Speech-to-Text</span>
                      <span className={`font-semibold ${
                        deviceCaps?.speechRecognition ? "text-emerald-600" : "text-muted-foreground/70"
                      }`}>
                        {deviceCaps?.speechRecognition ? (deviceCaps?.isPixelOrAndroid ? "Pixel Native Voice" : "Browser Ready") : "Unavailable"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. TypeSafe Jev Cloud Configuration & API Key */}
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="size-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">TypeSafe API Key</span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                        jevInfo?.jev?.hasKey
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {jevInfo?.jev?.hasKey ? "Key Configured" : "No Key Set (Offline)"}
                    </span>
                  </div>

                  <form onSubmit={saveApiKey} className="flex flex-col gap-2 mt-1">
                    <div className="relative flex items-center">
                      <input
                        type={showApiKey ? "text" : "password"}
                        placeholder={jevInfo?.jev?.hasKey ? "Key is set (enter new key to replace)" : "Enter TypeSafe API key (sk-...)"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="w-full rounded-lg border border-border bg-secondary/40 py-1.5 ps-3 pe-10 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute end-2 text-muted-foreground hover:text-foreground p-1"
                      >
                        {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {jevInfo?.jev?.keySource ? `Loaded from: ${jevInfo.jev.keySource}` : "Using offline engine by default"}
                      </span>
                      <div className="flex items-center gap-2">
                        {jevInfo?.jev?.hasKey && (
                          <button
                            type="button"
                            onClick={removeApiKey}
                            className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-secondary"
                          >
                            Remove Key
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={savingKey || !apiKeyInput.trim()}
                          className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          {savingKey ? "Saving..." : "Save Key"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* 3. Active Classifier Mode */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">Active Classifier Mode</span>
                    <span className="text-xs text-muted-foreground">
                      {jevInfo?.jev?.mode === "online"
                        ? "TypeSafe Jev Cloud (online)"
                        : "Offline Heuristic Engine (local)"}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      jevInfo?.jev?.mode === "online"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {jevInfo?.jev?.mode || "offline"}
                  </span>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-2xs">
                  <span className="text-xs font-semibold text-foreground">Model</span>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary/50 px-2.5 py-1.5 rounded-lg border border-border/50">
                    {jevInfo?.jev?.model || "jev-latest"}
                  </span>

                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={testJevConnection}
                      disabled={testingJev}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {testingJev ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <span>Test Connection</span>
                      )}
                    </button>

                    {testResult && (
                      <div className="flex items-center gap-1.5 text-xs">
                        {testResult.success ? (
                          <>
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            <span className="text-emerald-600 font-medium">Healthy</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="size-4 text-destructive" />
                            <span className="text-destructive font-medium">Error</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {testResult && (
                    <p className="text-xs text-muted-foreground mt-2 bg-secondary/40 p-2.5 rounded-lg">
                      {testResult.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <NewTypeDialog
        open={newTypeOpen}
        onOpenChange={setNewTypeOpen}
        onCreated={() => fetchTypes()}
      />
    </>
  );
}