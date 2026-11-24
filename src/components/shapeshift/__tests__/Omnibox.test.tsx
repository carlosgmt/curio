import { describe, expect, it, mock } from "bun:test";
import React, { act } from "react";
import { Window } from "happy-dom";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
}));

const DOM_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "Event",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "getComputedStyle",
] as const;

describe("Omnibox Q3 Keyboard Contract, Optimistic Capture & Q4 Web Speech Dictation", () => {
  it("hides Mic when Web Speech API is unsupported, shows Mic when supported, and honors Enter vs ArrowDown+Enter vs Cmd+Enter vs Shift+Enter", async () => {
    const win = new Window({ url: "http://localhost:3000/curio" });
    const prevGlobals: Record<string, unknown> = {};
    for (const key of DOM_GLOBALS) {
      prevGlobals[key] = (globalThis as any)[key];
      const val = (win as any)[key];
      if (val !== undefined) {
        (globalThis as any)[key] = typeof val === "function" && key === "getComputedStyle" ? val.bind(win) : val;
      }
    }
    (globalThis as any).window = win;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const prevFetch = globalThis.fetch;

    const capturedBodies: any[] = [];
    const suggestCalls: string[] = [];

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v1/capture/suggest")) {
        suggestCalls.push(url);
        return new Response(
          JSON.stringify({
            suggestions: [
              {
                title: "Mimar",
                subtitle: "Calle San Matías, Granada",
                typePath: "/place/spot",
                badgeLabel: "PLACE",
                canonicalUrl: "https://www.google.com/maps/search/?api=1&query=37.1773,-3.5986",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/capture/intent") || url.includes("preview=true")) {
        return new Response(JSON.stringify({ intent: "ADD_ENTITY", confidence: 0.9 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/v1/capture") && init?.method === "POST") {
        const parsed = init.body ? JSON.parse(String(init.body)) : {};
        capturedBodies.push(parsed);
        return new Response(
          JSON.stringify({
            status: "created",
            save: {
              id: `save-${capturedBodies.length}`,
              isPrivateMemo: Boolean(parsed.isPrivateMemo),
              typePath: parsed.forcedTypePath || "/place/spot",
              createdAt: new Date().toISOString(),
            },
            entity: parsed.isPrivateMemo
              ? null
              : {
                  id: `ent-${capturedBodies.length}`,
                  title: parsed.input,
                  coreType: "PLACE",
                  typePath: "/place/spot",
                  canonicalUrl: "https://maps.google.com",
                },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    globalThis.fetch = mockFetch;
    (win as any).fetch = mockFetch;

    try {
      const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
      const { Omnibox } = await import("../Omnibox");
      const optimisticStarts: any[] = [];

      // 1. Without SpeechRecognition -> Mic button MUST be hidden
      delete (win as any).SpeechRecognition;
      delete (win as any).webkitSpeechRecognition;

      const c1 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c1 as any);
      const view1 = render(
        React.createElement(Omnibox, {
          activeBoardContext: { id: "board-granada", slug: "granada", title: "Granada Spots" },
          onOptimisticStart: (card) => optimisticStarts.push(card),
        }),
        { container: c1 }
      );
      expect(view1.queryByTestId("omnibox-mic-btn")).toBeNull();

      const inputEl = view1.getByLabelText("Capture or command") as HTMLInputElement;

      // Type "Mimar Granada" and wait for debounced /suggest
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: "Mimar Granada" } });
      });
      expect(inputEl.value).toBe("Mimar Granada");
      await act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });
      expect(suggestCalls.length).toBeGreaterThanOrEqual(1);

      // Q3.1: Bare Enter WITHOUT ArrowDown submits full typed query "Mimar Granada" + activeBoardContext
      await act(async () => {
        fireEvent.keyDown(inputEl, { key: "Enter", code: "Enter" });
        fireEvent.submit(inputEl.closest("form")!);
      });
      expect(capturedBodies.length).toBe(1);
      expect(capturedBodies[0].input).toBe("Mimar Granada");
      expect(capturedBodies[0].listId).toBe("board-granada");
      expect(optimisticStarts.length).toBe(1);
      expect(inputEl.value).toBe("");

      // Q3.2: ArrowDown + Enter selects suggestion "Mimar" while preserving queryContext: "Mimar Granada"
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: "Mimar Granada" } });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });
      await act(async () => {
        fireEvent.keyDown(inputEl, { key: "ArrowDown", code: "ArrowDown" });
      });
      await act(async () => {
        fireEvent.keyDown(inputEl, { key: "Enter", code: "Enter" });
      });
      expect(capturedBodies.length).toBe(2);
      expect(capturedBodies[1].input).toBe("Mimar");
      expect(capturedBodies[1].queryContext).toBe("Mimar Granada");
      expect(capturedBodies[1].listId).toBe("board-granada");

      // Q3.3: Cmd+Enter saves private memo
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: "Remember to book terrace table at 9pm" } });
      });
      await act(async () => {
        fireEvent.keyDown(inputEl, { key: "Enter", code: "Enter", metaKey: true });
      });
      expect(capturedBodies.length).toBe(3);
      expect(capturedBodies[2].isPrivateMemo).toBe(true);
      expect(capturedBodies[2].forcedTypePath).toBe("/memo/personal");

      // Q3.4: Shift+Enter forces new card (forceNew: true)
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: "Dune" } });
      });
      await act(async () => {
        fireEvent.keyDown(inputEl, { key: "Enter", code: "Enter", shiftKey: true });
      });
      expect(capturedBodies.length).toBe(4);
      expect(capturedBodies[3].forceNew).toBe(true);

      // URL input skips /suggest fan-out
      const prevSuggestCount = suggestCalls.length;
      await act(async () => {
        fireEvent.change(inputEl, { target: { value: "https://maps.app.goo.gl/xyz999" } });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });
      expect(suggestCalls.length).toBe(prevSuggestCount);

      cleanup();

      // 2. With webkitSpeechRecognition -> Mic button renders and dictates via Web Speech API
      const instances: MockSpeechRecognition[] = [];
      class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = "en-US";
        onresult: any = null;
        onerror: any = null;
        onend: any = null;
        start() {
          instances.push(this);
        }
        stop() {
          this.onend?.();
        }
      }
      (win as any).webkitSpeechRecognition = MockSpeechRecognition;

      const c2 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c2 as any);
      const view2 = render(React.createElement(Omnibox, {}), { container: c2 });
      const micBtn = view2.queryByTestId("omnibox-mic-btn");
      expect(micBtn).not.toBeNull();

      await act(async () => {
        fireEvent.click(micBtn!);
      });
      const recognitionInstance = instances[0];
      expect(recognitionInstance).toBeDefined();

      await act(async () => {
        recognitionInstance.onresult?.({
          resultIndex: 0,
          results: [Object.assign([{ transcript: "Bar Provincias Granada" }], { isFinal: true })],
        });
      });

      const dictatedInput = view2.getByLabelText("Capture or command") as HTMLInputElement;
      expect(dictatedInput.value).toContain("Bar Provincias Granada");
      cleanup();
    } finally {
      globalThis.fetch = prevFetch;
      for (const key of DOM_GLOBALS) {
        if (prevGlobals[key] === undefined) {
          delete (globalThis as any)[key];
        } else {
          (globalThis as any)[key] = prevGlobals[key];
        }
      }
    }
  });
});
