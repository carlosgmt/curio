const TRACKED_IG_COOKIES = new Set([
  "sessionid",
  "csrftoken",
  "ds_user_id",
  "ig_did",
  "mid",
  "datr",
  "rur",
]);
const REFRESH_ALARM_NAME = "curio-ig-cookie-refresh";
const DEBOUNCED_ALARM_NAME = "curio-ig-cookie-debounced";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function syncInstagramCookiesInBackground(force = false) {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "instagram.com" });
    const filtered = cookies
      .filter((c) => TRACKED_IG_COOKIES.has(c.name.toLowerCase()) && c.value)
      .sort((a, b) => a.name.localeCompare(b.name));

    const hasSessionId = filtered.some((c) => c.name.toLowerCase() === "sessionid");
    if (!hasSessionId) return;

    const cookieHeader = filtered.map((c) => `${c.name}=${c.value}`).join("; ");
    const hash = await sha256Hex(cookieHeader);
    const stored = await chrome.storage.local.get(["lastIgCookieHash", "lastIgCookieSyncAt"]);

    if (
      !force &&
      stored.lastIgCookieHash === hash &&
      typeof stored.lastIgCookieSyncAt === "number" &&
      Date.now() - stored.lastIgCookieSyncAt < SIX_HOURS_MS
    ) {
      return;
    }

    const endpoints = [
      "https://mini.orca-banjo.ts.net/curio/api/v1/sync/instagram/auth",
      "http://127.0.0.1:3000/curio/api/v1/sync/instagram/auth",
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ cookie: cookieHeader }),
        });
        if (res.ok) {
          await chrome.storage.local.set({
            lastIgCookieHash: hash,
            lastIgCookieSyncAt: Date.now(),
          });
          return;
        }
      } catch {
        // Try next endpoint silently
      }
    }
  } catch {
    // Non-fatal background sync
  }
}

function ensureRefreshAlarm() {
  chrome.alarms.create(REFRESH_ALARM_NAME, { periodInMinutes: 360 });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "curio-capture",
    title: "Capture to Curio Taste Graph",
    contexts: ["page", "selection", "link", "image"],
  });
  ensureRefreshAlarm();
  syncInstagramCookiesInBackground(false);
});

chrome.runtime.onStartup.addListener(() => {
  ensureRefreshAlarm();
  syncInstagramCookiesInBackground(false);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM_NAME) {
    syncInstagramCookiesInBackground(false);
  } else if (alarm.name === DEBOUNCED_ALARM_NAME) {
    syncInstagramCookiesInBackground(false);
  }
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.removed) return;
  const { cookie } = changeInfo;
  if (!cookie || !cookie.domain || !cookie.domain.endsWith("instagram.com")) return;
  if (!TRACKED_IG_COOKIES.has(cookie.name.toLowerCase())) return;
  chrome.alarms.create(DEBOUNCED_ALARM_NAME, { delayInMinutes: 0.1 });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "curio-capture") {
    const input = info.selectionText || info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
    if (!input) return;

    try {
      await fetch("http://127.0.0.1:3000/curio/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      }).catch(() => {
        return fetch("http://127.0.0.1:3000/api/v1/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
      });
    } catch (err) {
      console.error("Context menu capture error:", err);
    }
  }
});
