document.addEventListener("DOMContentLoaded", async () => {
  const titleInput = document.getElementById("title");
  const urlInput = document.getElementById("url");
  const notesInput = document.getElementById("notes");
  const form = document.getElementById("capture-form");
  const saveBtn = document.getElementById("save-btn");
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
});
