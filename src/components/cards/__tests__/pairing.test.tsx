import { describe, expect, it, mock } from "bun:test";
import React, { act } from "react";
import { Window } from "happy-dom";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
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
  "HTMLTextAreaElement",
  "HTMLButtonElement",
  "Event",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "getComputedStyle",
] as const;

describe("PolymorphicCard, SectionGroupView & CardLightboxModal Pairing + Zero-N+1", () => {
  it("surfaces + Pair at 0 connections without firing GET /api/v1/connections N+1 requests, and triggers pairing from CardLightboxModal", async () => {
    const win = new Window({ url: "http://localhost:3000/curio" });
    const prevGlobals: Record<string, unknown> = {};
    for (const key of DOM_GLOBALS) {
      prevGlobals[key] = (globalThis as any)[key];
      const val = (win as any)[key];
      if (val !== undefined) {
        (globalThis as any)[key] =
          typeof val === "function" && key === "getComputedStyle" ? val.bind(win) : val;
      }
    }
    (globalThis as any).window = win;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const prevFetch = globalThis.fetch;

    const connectionGetCalls: string[] = [];
    const mockFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/connections")) {
        connectionGetCalls.push(url);
      }
      if (url.includes("/api/v1/lists/memberships")) {
        return new Response(JSON.stringify({ boards: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/v1/types")) {
        return new Response(JSON.stringify({ types: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    globalThis.fetch = mockFetch;
    (win as any).fetch = mockFetch;

    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");

    try {
      const { PolymorphicCard } = await import("../PolymorphicCard");
      const { SectionGroupView } = await import("../../lists/SectionGroupView");
      const { CardLightboxModal } = await import("../../lightbox/CardLightboxModal");

      // 1. Mount SectionGroupView with 8 board cards hydrated with connections=[]
      const sectionItems = Array.from({ length: 8 }, (_, idx) => ({
        save: {
          id: `board-save-${idx}`,
          userId: "u-1",
          entityId: `ent-${idx}`,
          isPrivateMemo: false,
          typePath: "/media/film",
          createdAt: new Date().toISOString(),
        } as any,
        entity: {
          id: `ent-${idx}`,
          title: `Film Card ${idx}`,
          coreType: "MEDIA",
          typePath: "/media/film",
          canonicalUrl: `https://example.com/film-${idx}`,
          coreStructuredData: {},
        } as any,
        connections: [],
      }));

      const pairedFromCard: string[] = [];
      const clickedCardIds: string[] = [];

      const c1 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c1 as any);

      const boardView = render(
        React.createElement(SectionGroupView, {
          sections: [{ name: null, items: sectionItems }],
          layout: "grid",
          onConnect: (card) => pairedFromCard.push(card.save.id),
          onCardClick: (card) => clickedCardIds.push(card.save.id),
        }),
        { container: c1 }
      );

      // Zero GET /api/v1/connections N+1 calls on board mount!
      expect(connectionGetCalls.length).toBe(0);

      // Every card surfaces + Pair even when connections is empty ([])
      const pairButtons = boardView.getAllByTestId("pair-card-btn");
      expect(pairButtons.length).toBe(8);

      // Clicking + Pair opens pairing without bubbling to onCardClick
      fireEvent.click(pairButtons[0]);
      expect(pairedFromCard).toEqual(["board-save-0"]);
      expect(clickedCardIds).toEqual([]);

      cleanup();

      // 2. Private memos and optimistic cards do NOT show + Pair or fetch connections
      const c2 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c2 as any);
      const memoView = render(
        React.createElement(PolymorphicCard, {
          item: {
            save: {
              id: "memo-1",
              isPrivateMemo: true,
              privateTitle: "Secret Note",
              createdAt: new Date().toISOString(),
            },
            entity: null,
            connections: [],
          },
          onConnect: () => pairedFromCard.push("memo-1"),
        }),
        { container: c2 }
      );
      expect(memoView.queryByTestId("pair-card-btn")).toBeNull();
      cleanup();

      const c3 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c3 as any);
      const optView = render(
        React.createElement(PolymorphicCard, {
          item: {
            save: {
              id: "optimistic-temp-1",
              isPrivateMemo: false,
              enrichmentStatus: "OPTIMISTIC",
              typePath: "/product",
              createdAt: new Date().toISOString(),
            },
            entity: {
              id: "opt-ent",
              title: "Pending Capture",
              coreType: "PRODUCT",
              canonicalUrl: "",
            },
          },
          onConnect: () => pairedFromCard.push("optimistic-temp-1"),
        }),
        { container: c3 }
      );
      expect(optView.queryByTestId("pair-card-btn")).toBeNull();
      expect(connectionGetCalls.length).toBe(0);
      cleanup();

      // 3. CardLightboxModal surfaces + Pair at 0 connections without firing GET /api/v1/connections and honors suppressEscape
      const lightboxPaired: string[] = [];
      let lightboxClosedCount = 0;
      const sampleCard = {
        save: {
          id: "save-wine-1",
          isPrivateMemo: false,
          typePath: "/product/beverage/wine",
          createdAt: new Date().toISOString(),
        },
        entity: {
          id: "ent-wine-1",
          title: "Château Musar 2016",
          coreType: "PRODUCT",
          typePath: "/product/beverage/wine",
          canonicalUrl: "https://example.com/musar",
        },
        connections: [],
      };

      const c4 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c4 as any);
      const lbView = render(
        React.createElement(CardLightboxModal, {
          card: sampleCard,
          isOpen: true,
          suppressEscape: true,
          onClose: () => {
            lightboxClosedCount++;
          },
          onConnect: (card) => lightboxPaired.push(card.save.id),
        }),
        { container: c4 }
      );

      expect(connectionGetCalls.length).toBe(0);
      const lbPairBtn = lbView.getByTestId("lightbox-pair-btn");
      expect(lbPairBtn).toBeDefined();
      fireEvent.click(lbPairBtn);
      expect(lightboxPaired).toEqual(["save-wine-1"]);

      // Escape while PairingModal is open (suppressEscape=true) does NOT close CardLightboxModal
      fireEvent.keyDown(win as any, { key: "Escape" });
      expect(lightboxClosedCount).toBe(0);

      // Re-render with suppressEscape=false -> Escape closes CardLightboxModal
      lbView.rerender(
        React.createElement(CardLightboxModal, {
          card: sampleCard,
          isOpen: true,
          suppressEscape: false,
          onClose: () => {
            lightboxClosedCount++;
          },
          onConnect: (card) => lightboxPaired.push(card.save.id),
        })
      );
      fireEvent.keyDown(win as any, { key: "Escape" });
      expect(lightboxClosedCount).toBe(1);

      cleanup();
    } finally {
      cleanup();
      globalThis.fetch = prevFetch;
      for (const key of DOM_GLOBALS) {
        if (prevGlobals[key] === undefined) {
          delete (globalThis as any)[key];
        } else {
          (globalThis as any)[key] = prevGlobals[key];
        }
      }
      await win.happyDOM.close();
    }
  });

  it("renders Home wear-logs toggle (aria-pressed) and sends typePathPrefix on New Type smart-list prompt", async () => {
    const win = new Window({ url: "http://localhost:3000/curio" });
    const prevGlobals: Record<string, unknown> = {};
    for (const key of DOM_GLOBALS) {
      prevGlobals[key] = (globalThis as any)[key];
      const val = (win as any)[key];
      if (val !== undefined) {
        (globalThis as any)[key] =
          typeof val === "function" && key === "getComputedStyle" ? val.bind(win) : val;
      }
    }
    (globalThis as any).window = win;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const prevFetch = globalThis.fetch;

    const captureGetUrls: string[] = [];
    const createdListPayloads: any[] = [];

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/api/v1/auth/me")) {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: "user-1",
              username: "carlos",
              email: "carlos@curio.local",
              onboardingCompleted: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/capture") && method === "GET") {
        captureGetUrls.push(url);
        const includeWear = url.includes("includeWearLogs=true");
        const saves = includeWear
          ? [
              {
                save: {
                  id: "save-wear-1",
                  isPrivateMemo: false,
                  typePath: "/style/outfit",
                  createdAt: new Date().toISOString(),
                },
                entity: {
                  id: "ent-wear-1",
                  title: "Daily Fit 01",
                  coreType: "PRODUCT",
                  typePath: "/style/outfit",
                  canonicalUrl: "closet://outfit/1",
                  coreStructuredData: { kind: "worn", items: [] },
                },
                connections: [],
              },
              {
                save: {
                  id: "save-film-1",
                  isPrivateMemo: false,
                  typePath: "/media/film",
                  createdAt: new Date().toISOString(),
                },
                entity: {
                  id: "ent-film-1",
                  title: "Past Lives",
                  coreType: "MEDIA",
                  typePath: "/media/film",
                  canonicalUrl: "https://example.com/past-lives",
                },
                connections: [],
              },
            ]
          : [
              {
                save: {
                  id: "save-film-1",
                  isPrivateMemo: false,
                  typePath: "/media/film",
                  createdAt: new Date().toISOString(),
                },
                entity: {
                  id: "ent-film-1",
                  title: "Past Lives",
                  coreType: "MEDIA",
                  typePath: "/media/film",
                  canonicalUrl: "https://example.com/past-lives",
                },
                connections: [],
              },
            ];
        return new Response(
          JSON.stringify({
            saves,
            nextCursor: null,
            totalCount: includeWear ? 80 : 1,
            vaultTotalCount: 80,
            wishlistCount: 0,
            wearLogCount: 79,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/capture") && method === "POST") {
        return new Response(
          JSON.stringify({
            status: "created",
            save: {
              id: "save-wine-new",
              isPrivateMemo: false,
              typePath: "/product/beverage/wine",
              createdAt: new Date().toISOString(),
            },
            entity: {
              id: "ent-wine-new",
              title: "Ganevat Les Cèdres",
              coreType: "PRODUCT",
              typePath: "/product/beverage/wine",
              canonicalUrl: "https://example.com/ganevat",
            },
            connections: [],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/lists") && method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        createdListPayloads.push(body);
        return new Response(
          JSON.stringify({
            list: {
              id: "list-wines",
              title: body.title,
              slug: "wines",
              visibility: "PUBLIC",
              autoRules: body.autoRules,
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/lists/wines") && method === "GET") {
        return new Response(
          JSON.stringify({
            list: {
              id: "list-wines",
              title: "Wines",
              slug: "wines",
              visibility: "PUBLIC",
              autoRules: { typePathPrefix: "/product/beverage/wine" },
            },
            sections: [],
            ancestors: [],
            children: [],
            itemCount: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/lists") && method === "GET") {
        return new Response(
          JSON.stringify({
            lists: [
              {
                id: "list-outfits",
                title: "Outfits",
                slug: "outfits",
                visibility: "PRIVATE",
                autoRules: { typePathPrefix: "/style/outfit" },
                itemCount: 79,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/sync/")) {
        return new Response(JSON.stringify({ synced: false, isStale: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    globalThis.fetch = mockFetch;
    (win as any).fetch = mockFetch;

    const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");

    try {
      const HomeMod = await import("@/app/page");
      const Home = HomeMod.default;

      const container = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(container as any);

      const view = render(React.createElement(Home), { container });

      // Wait for authenticated Home stream to load with wear-logs tucked
      const toggleBtn = await waitFor(() => view.getByTestId("toggle-wear-logs"));
      expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");
      expect(toggleBtn.textContent).toContain("Wear logs (79)");
      expect(container.textContent).toContain("79 wear logs tucked in Outfits");
      expect(captureGetUrls.some((u) => !u.includes("includeWearLogs=true"))).toBe(true);

      // Click toggle -> flips aria-pressed to true and fetches with includeWearLogs=true
      await act(async () => {
        fireEvent.click(toggleBtn);
      });
      await waitFor(() => {
        expect(toggleBtn.getAttribute("aria-pressed")).toBe("true");
        expect(captureGetUrls.some((u) => u.includes("includeWearLogs=true"))).toBe(true);
      });
      expect(win.localStorage.getItem("curio_show_wear_logs")).toBe("true");

      // Submit a Wine capture in Omnibox -> triggers "New type added: Wine" prompt -> creates list with typePathPrefix!
      const omniboxInput = view.getByLabelText("Capture or command") as HTMLInputElement;
      expect(omniboxInput).toBeTruthy();
      await act(async () => {
        fireEvent.change(omniboxInput, { target: { value: "Ganevat Les Cèdres" } });
      });
      await act(async () => {
        fireEvent.keyDown(omniboxInput, { key: "Enter", code: "Enter" });
        fireEvent.submit(omniboxInput.closest("form")!);
      });

      const createWinesBtn = await waitFor(() => {
        const btn = Array.from(container.querySelectorAll("button")).find(
          (b) => (b.textContent || "").includes("Create") && (b.textContent || "").includes("Wines")
        );
        expect(btn).toBeTruthy();
        return btn!;
      });

      await act(async () => {
        fireEvent.click(createWinesBtn);
      });

      await waitFor(() => {
        expect(createdListPayloads.length).toBe(1);
      });
      expect(createdListPayloads[0].title).toBe("Wines");
      expect(createdListPayloads[0].autoRules).toEqual({
        typePathPrefix: "/product/beverage/wine",
      });

      cleanup();
    } finally {
      cleanup();
      globalThis.fetch = prevFetch;
      for (const key of DOM_GLOBALS) {
        if (prevGlobals[key] === undefined) {
          delete (globalThis as any)[key];
        } else {
          (globalThis as any)[key] = prevGlobals[key];
        }
      }
      await win.happyDOM.close();
    }
  });

  it("enforces readOnly public rendering in SectionGroupView, CardLightboxModal & CardDeepLinkClient, syncs lightbox unlink, and populates board companions in PairingModal", async () => {
    const win = new Window({ url: "http://localhost:3000/curio" });
    const prevGlobals: Record<string, unknown> = {};
    for (const key of DOM_GLOBALS) {
      prevGlobals[key] = (globalThis as any)[key];
      const val = (win as any)[key];
      if (val !== undefined) {
        (globalThis as any)[key] =
          typeof val === "function" && key === "getComputedStyle" ? val.bind(win) : val;
      }
    }
    (globalThis as any).window = win;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const prevFetch = globalThis.fetch;

    const apiCalls: Array<{ method: string; url: string }> = [];
    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      apiCalls.push({ method, url });

      if (url.includes("/api/v1/auth/me")) {
        return new Response(
          JSON.stringify({
            success: true,
            token: "healed-session-token",
            user: {
              id: "user-1",
              username: "carlos",
              email: "carlos@curio.local",
              onboardingCompleted: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/capture") && method === "GET") {
        return new Response(
          JSON.stringify({
            saves: [
              {
                save: {
                  id: "memo-local-1",
                  isPrivateMemo: true,
                  privateTitle: "Private Vault Memo",
                  createdAt: new Date().toISOString(),
                },
                entity: null,
                connections: [],
              },
            ],
            nextCursor: null,
            totalCount: 1,
            vaultTotalCount: 3,
            wishlistCount: 0,
            wearLogCount: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/lists/outfits") && method === "GET") {
        return new Response(
          JSON.stringify({
            list: {
              id: "list-outfits",
              userId: "user-1",
              title: "Outfits",
              slug: "outfits",
              visibility: "PRIVATE",
              autoRules: { typePathPrefix: "/style/outfit" },
            },
            sections: [
              {
                name: null,
                items: [
                  {
                    save: {
                      id: "outfit-save-1",
                      userId: "user-1",
                      isPrivateMemo: false,
                      typePath: "/style/outfit",
                      createdAt: new Date().toISOString(),
                    },
                    entity: {
                      id: "outfit-ent-1",
                      title: "Autumn Linen Fit",
                      coreType: "PRODUCT",
                      typePath: "/style/outfit",
                      canonicalUrl: "closet://outfit/1",
                      coreStructuredData: { kind: "worn", items: [] },
                    },
                    connections: [],
                  },
                  {
                    save: {
                      id: "outfit-save-2",
                      userId: "user-1",
                      isPrivateMemo: false,
                      typePath: "/style/outfit",
                      createdAt: new Date().toISOString(),
                    },
                    entity: {
                      id: "outfit-ent-2",
                      title: "Evening Chore Coat Fit",
                      coreType: "PRODUCT",
                      typePath: "/style/outfit",
                      canonicalUrl: "closet://outfit/2",
                      coreStructuredData: { kind: "worn", items: [] },
                    },
                    connections: [],
                  },
                ],
              },
            ],
            ancestors: [],
            children: [],
            itemCount: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/lists") && !url.includes("memberships") && method === "GET") {
        return new Response(
          JSON.stringify({
            lists: [
              {
                id: "list-outfits",
                userId: "user-1",
                title: "Outfits",
                slug: "outfits",
                visibility: "PRIVATE",
                autoRules: { typePathPrefix: "/style/outfit" },
                itemCount: 2,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/graph/suggestions")) {
        return new Response(JSON.stringify({ suggestions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/v1/sync/")) {
        return new Response(JSON.stringify({ synced: false, isStale: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    globalThis.fetch = mockFetch;
    (win as any).fetch = mockFetch;

    const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");

    try {
      const { SectionGroupView } = await import("../../lists/SectionGroupView");
      const { CardLightboxModal } = await import("../../lightbox/CardLightboxModal");
      const { CardDeepLinkClient } = await import("@/app/card/[id]/CardDeepLinkClient");
      const HomeMod = await import("@/app/page");
      const Home = HomeMod.default;

      // 1. SectionGroupView readOnly={true} hides Wish, Board, + Pair, and SynapsePill unlink buttons
      const c1 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c1 as any);
      const roBoard = render(
        React.createElement(SectionGroupView, {
          readOnly: true,
          layout: "grid",
          sections: [
            {
              name: null,
              items: [
                {
                  save: {
                    id: "pub-save-1",
                    isPrivateMemo: false,
                    typePath: "/media/film",
                    createdAt: new Date().toISOString(),
                  } as any,
                  entity: {
                    id: "pub-ent-1",
                    title: "In the Mood for Love",
                    coreType: "MEDIA",
                    typePath: "/media/film",
                    canonicalUrl: "https://example.com/itmfl",
                  } as any,
                  connections: [
                    {
                      connectionId: "conn-ro-1",
                      connectionType: "SOUNDTRACK_TO",
                      direction: "outgoing",
                      saveId: "pub-save-2",
                      title: "Yumeji's Theme",
                      coreType: "MEDIA",
                    },
                  ],
                },
              ],
            },
          ],
          onConnect: () => {},
        }),
        { container: c1 }
      );
      expect(roBoard.queryByTestId("wish-toggle")).toBeNull();
      expect(roBoard.queryByTestId("add-to-board-btn")).toBeNull();
      expect(roBoard.queryByTestId("pair-card-btn")).toBeNull();
      expect(c1.textContent).toContain("Yumeji's Theme");
      expect(c1.querySelector('button[title="Unlink connection"]')).toBeNull();
      cleanup();

      // 2. CardLightboxModal readOnly={true} makes 0 /api/v1/types or /api/v1/lists/memberships calls and hides owner controls
      apiCalls.length = 0;
      const c2 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c2 as any);
      const roLb = render(
        React.createElement(CardLightboxModal, {
          isOpen: true,
          readOnly: true,
          onClose: () => {},
          card: {
            save: {
              id: "pub-save-1",
              isPrivateMemo: false,
              typePath: "/media/film",
              createdAt: new Date().toISOString(),
            },
            entity: {
              id: "pub-ent-1",
              title: "In the Mood for Love",
              coreType: "MEDIA",
              typePath: "/media/film",
              canonicalUrl: "https://example.com/itmfl",
            },
            connections: [],
          },
        }),
        { container: c2 }
      );
      expect(apiCalls.length).toBe(0);
      expect(roLb.queryByTestId("lightbox-wish-toggle")).toBeNull();
      expect(roLb.queryByTestId("edit-type-toggle")).toBeNull();
      expect(roLb.queryByTestId("edit-card-details-toggle")).toBeNull();
      expect(roLb.queryByTestId("lightbox-pair-btn")).toBeNull();
      expect(c2.textContent).not.toContain("Save Changes");
      expect(c2.textContent).toContain("Close");
      cleanup();

      // 3. CardDeepLinkClient with initialDetails={null} (private save SSR) renders lock screen with zero leaked fields
      const c3 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c3 as any);
      render(
        React.createElement(CardDeepLinkClient, {
          saveId: "priv-save-99",
          initialDetails: null,
          initialIsOwner: false,
        }),
        { container: c3 }
      );
      expect(c3.textContent).toContain("Private Curio Save");
      cleanup();

      // 4. CardLightboxModal unlink propagates onUnlink(connectionId) to parent state
      const unlinkedIds: string[] = [];
      const c4 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c4 as any);
      render(
        React.createElement(CardLightboxModal, {
          isOpen: true,
          onClose: () => {},
          onConnect: () => {},
          onUnlink: (connId) => unlinkedIds.push(connId),
          card: {
            save: {
              id: "owner-save-1",
              isPrivateMemo: false,
              typePath: "/product/beverage/wine",
              createdAt: new Date().toISOString(),
            },
            entity: {
              id: "owner-ent-1",
              title: "Lopez de Heredia Bosconia",
              coreType: "PRODUCT",
              typePath: "/product/beverage/wine",
              canonicalUrl: "https://example.com/bosconia",
            },
            connections: [
              {
                connectionId: "conn-del-1",
                connectionType: "PAIRED_WITH",
                direction: "outgoing",
                saveId: "owner-save-2",
                title: "Roast Lamb",
                coreType: "CULINARY",
              },
            ],
          },
        }),
        { container: c4 }
      );
      const unlinkBtn = c4.querySelector('button[title="Unlink connection"]') as HTMLButtonElement;
      expect(unlinkBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(unlinkBtn);
      });
      await waitFor(() => {
        expect(unlinkedIds).toEqual(["conn-del-1"]);
      });
      expect(apiCalls.some((c) => c.method === "DELETE" && c.url.includes("connectionId=conn-del-1"))).toBe(true);
      cleanup();

      // 5. Home board view ("Outfits") populates PairingModal with tucked board companions while excluding private memos
      apiCalls.length = 0;
      win.localStorage.setItem("curio_show_wear_logs", "true");
      const c5 = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(c5 as any);
      const homeView = render(React.createElement(Home), { container: c5 });

      await waitFor(() => {
        expect(homeView.getByTestId("toggle-wear-logs").getAttribute("aria-pressed")).toBe("true");
      });
      // Hydrated curio_show_wear_logs="true" must NOT fire an initial non-includeWearLogs GET /api/v1/capture
      const captureGets = apiCalls.filter((c) => c.method === "GET" && c.url.includes("/api/v1/capture"));
      expect(captureGets.length).toBe(1);
      expect(captureGets[0].url).toContain("includeWearLogs=true");

      // Switch to Outfits board tab
      const outfitsTab = Array.from(c5.querySelectorAll("button")).find((b) =>
        (b.textContent || "").includes("Outfits")
      );
      expect(outfitsTab).toBeTruthy();
      await act(async () => {
        fireEvent.click(outfitsTab!);
      });

      const boardPairBtns = await waitFor(() => homeView.getAllByTestId("pair-card-btn"));
      expect(boardPairBtns.length).toBe(2);

      await act(async () => {
        fireEvent.click(boardPairBtns[0]);
      });

      // PairingModal uses aria-labelledby, lists companion board card ("Evening Chore Coat Fit"), and excludes private memo ("Private Vault Memo")
      const dialog = c5.querySelector('[role="dialog"]') as HTMLElement;
      expect(dialog).toBeTruthy();
      const labelledBy = dialog.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(win.document.getElementById(labelledBy!)?.textContent).toContain(
        "Establish Synaptic Pair"
      );
      expect(dialog.textContent).toContain("Evening Chore Coat Fit");
      expect(dialog.textContent).not.toContain("Private Vault Memo");
      cleanup();
    } finally {
      cleanup();
      globalThis.fetch = prevFetch;
      for (const key of DOM_GLOBALS) {
        if (prevGlobals[key] === undefined) {
          delete (globalThis as any)[key];
        } else {
          (globalThis as any)[key] = prevGlobals[key];
        }
      }
      await win.happyDOM.close();
    }
  });
});
