document.addEventListener("DOMContentLoaded", async () => {
  const titleInput = document.getElementById("title");
  const urlInput = document.getElementById("url");
  const notesInput = document.getElementById("notes");
  const form = document.getElementById("capture-form");
  const saveBtn = document.getElementById("save-btn");
  const igRefreshBtn = document.getElementById("ig-refresh-btn");
  const statusDiv = document.getElementById("status");

  // Get active tab details
  if (chrome.tabs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      titleInput.value = tab.title || "";
      urlInput.value = tab.url || "";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    statusDiv.className = "status";
    statusDiv.textContent = "Capturing to Curio...";

    const url = urlInput.value.trim();
    const notes = notesInput.value.trim();
    const input = notes ? `${url} — ${notes}` : url;

    try {
      const res = await fetch("http://127.0.0.1:3000/curio/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      }).catch(async () => {
        // Fallback to local root without /curio prefix
        return fetch("http://127.0.0.1:3000/api/v1/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
      });

      if (res.ok) {
        statusDiv.className = "status success";
        statusDiv.textContent = "✓ Saved to your taste graph!";
        setTimeout(() => window.close(), 1200);
      } else {
        throw new Error("Capture failed");
      }
    } catch {
      statusDiv.className = "status error";
      statusDiv.textContent = "Could not reach Curio at http://127.0.0.1:3000";
      saveBtn.disabled = false;
    }
  });

  if (igRefreshBtn) {
    igRefreshBtn.addEventListener("click", async () => {
      igRefreshBtn.disabled = true;
      statusDiv.className = "status";
      statusDiv.textContent = "Reading Instagram session...";

      try {
        const cookies = await chrome.cookies.getAll({ domain: "instagram.com" });
        const wanted = new Set(["sessionid", "csrftoken", "ds_user_id", "ig_did", "mid"]);
        const pairs = cookies
          .filter((c) => wanted.has(c.name) && c.value)
          .map((c) => `${c.name}=${c.value}`);
        const hasSessionId = cookies.some((c) => c.name === "sessionid" && c.value);

        if (!hasSessionId) {
          throw new Error("Not signed in to instagram.com in Chrome.");
        }

        const cookieHeader = pairs.join("; ");
        const endpoints = [
          "https://mini.orca-banjo.ts.net/curio/api/v1/sync/instagram/auth",
          "http://127.0.0.1:3000/curio/api/v1/sync/instagram/auth",
        ];

        let synced = false;
        let lastErr = "Could not reach Curio";
        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ cookie: cookieHeader }),
            });
            if (res.ok) {
              synced = true;
              break;
            }
            const errJson = await res.json().catch(() => ({}));
            lastErr = errJson.error || `HTTP ${res.status}`;
          } catch (e) {
            lastErr = e?.message || "Connection failed";
          }
        }

        if (!synced) {
          throw new Error(lastErr);
        }

        statusDiv.className = "status success";
        statusDiv.textContent = "✓ Instagram session synced to Curio!";
        setTimeout(() => window.close(), 1200);
      } catch (err) {
        statusDiv.className = "status error";
        statusDiv.textContent = err?.message || "Instagram session refresh failed";
      } finally {
        igRefreshBtn.disabled = false;
      }
    });
  }
});
