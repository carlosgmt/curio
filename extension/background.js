chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "curio-capture",
    title: "Capture to Curio Taste Graph",
    contexts: ["page", "selection", "link", "image"],
  });
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
