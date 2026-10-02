export type SmartActionKind =
  | "append_card"       // e.g. "add milk to groceries", "also need coffee", "groceries: eggs"
  | "update_card"       // e.g. "flight gate 12B, seat 14A", "flight delayed 45m"
  | "create_in_list"    // e.g. "add buy tickets to tasks"
  | "attach_to_parent"  // e.g. "I liked the ending of Norwegian Wood"
  | "standard_card";    // standard new card creation

export interface SmartActionTarget {
  kind: SmartActionKind;
  targetId?: string;
  targetTitle?: string;
  targetListId?: string;
  targetIntent?: string;
  content: string;
  itemsToAppend?: string[];
  updates?: Record<string, any>;
  label: string;
}

/**
 * Parses input text in real time to detect:
 * 1. "add X to Y" (append items to card or list)
 * 2. "also need/buy X" (append to active todo / grocery card)
 * 3. "CardTitle: item1, item2" (prefix-based append)
 * 4. "flight gate 12B, seat 14A" or "flight delayed 30m" (update registered travel card)
 * 5. "note on Y: X" or "I liked X about book Y" (attach child note to parent card)
 */
export function analyzeSmartInput(
  rawText: string,
  existingCards: Array<{ id: string; title: string; intent: string; listId: string; data?: any }>,
  existingLists: Array<{ id: string; name: string }>
): SmartActionTarget | null {
  const text = rawText.trim();
  if (text.length < 4) return null;

  // ── 1. Match "add X to Y" pattern ──────────────────────────────────────
  const addMatch = text.match(
    /^(?:add|put|include|insert)\s+(.+?)\s+(?:to|in|into|on)\s+(?:the\s+)?(.+?)(?:\s+list|\s+card)?$/i
  );

  if (addMatch) {
    const content = addMatch[1].trim();
    const targetName = addMatch[2].trim().toLowerCase();

    // Check if target matches an existing card (e.g. "Groceries" or "Shopping List")
    const matchedCard = existingCards.find(
      (c) =>
        c.title.toLowerCase() === targetName ||
        c.title.toLowerCase().includes(targetName) ||
        targetName.includes(c.title.toLowerCase())
    );

    if (matchedCard) {
      const items = content
        .split(/[,;\n]|\s+and\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        kind: "append_card",
        targetId: matchedCard.id,
        targetTitle: matchedCard.title,
        targetListId: matchedCard.listId,
        targetIntent: matchedCard.intent,
        content,
        itemsToAppend: items.length > 0 ? items : [content],
        label: `Append to "${matchedCard.title}"`,
      };
    }

    // Check if target matches an existing list (e.g. "Tasks", "Kitchen", "Money")
    const matchedList = existingLists.find(
      (l) =>
        l.name.toLowerCase() === targetName ||
        l.id.toLowerCase() === targetName ||
        l.name.toLowerCase().includes(targetName)
    );

    if (matchedList) {
      return {
        kind: "create_in_list",
        targetListId: matchedList.id,
        targetTitle: matchedList.name,
        content,
        label: `Add to ${matchedList.name} list`,
      };
    }
  }

  // ── 2. Match "also need / also buy / also grab / also X" pattern ────────
  const alsoMatch = text.match(
    /^(?:also\s+(?:need|buy|get|grab|pick up|want|take)?\s*|and\s+also\s+)(.+)$/i
  );

  if (alsoMatch) {
    const content = alsoMatch[1].trim();
    // Find candidate todo/list card (prioritize titled "groceries" / "shopping" or first active todo card)
    const candidateTodo =
      existingCards.find((c) =>
        c.intent === "todo" &&
        /(?:groceries|grocery|shopping|market|food|kitchen)/i.test(c.title)
      ) ||
      existingCards.find((c) => c.intent === "todo") ||
      existingCards.find((c) => c.listId === "tasks" || c.listId === "kitchen");

    if (candidateTodo) {
      const items = content
        .split(/[,;\n]|\s+and\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        kind: "append_card",
        targetId: candidateTodo.id,
        targetTitle: candidateTodo.title,
        targetListId: candidateTodo.listId,
        targetIntent: candidateTodo.intent,
        content,
        itemsToAppend: items.length > 0 ? items : [content],
        label: `Append to "${candidateTodo.title}"`,
      };
    }
  }

  // ── 3. Match "CardTitle: item1, item2" colon prefix append ────────────
  const colonPrefixMatch = text.match(/^([a-zA-Z0-9\s]{2,}?):\s*(.+)$/i);
  if (colonPrefixMatch) {
    const prefix = colonPrefixMatch[1].trim().toLowerCase();
    const rawItems = colonPrefixMatch[2].trim();

    const matchedCard = existingCards.find(
      (c) =>
        (c.intent === "todo" || Array.isArray(c.data?.items)) &&
        (c.title.toLowerCase() === prefix || c.title.toLowerCase().startsWith(prefix))
    );

    if (matchedCard) {
      const items = rawItems
        .split(/[,;\n]|\s+and\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        kind: "append_card",
        targetId: matchedCard.id,
        targetTitle: matchedCard.title,
        targetListId: matchedCard.listId,
        targetIntent: matchedCard.intent,
        content: rawItems,
        itemsToAppend: items.length > 0 ? items : [rawItems],
        label: `Append to "${matchedCard.title}"`,
      };
    }
  }

  // ── 4. Match Flight / Travel updates (gate, seat, terminal, delay) ──────
  const flightUpdateCues = /\b(gate|seat|terminal|delay(?:ed)?|boarding)\b/i;
  if (flightUpdateCues.test(text)) {
    // Find candidate travel / flight card
    const travelCard =
      existingCards.find((c) => c.intent === "travel") ||
      existingCards.find((c) => /flight|trip|travel/i.test(c.title));

    if (travelCard) {
      const updates: Record<string, any> = {};

      const gateMatch = text.match(/\bgate\s*([A-Za-z0-9]+)\b/i);
      if (gateMatch) updates.gate = gateMatch[1].toUpperCase();

      const seatMatch = text.match(/\bseat\s*([A-Za-z0-9]+)\b/i);
      if (seatMatch) updates.seat = seatMatch[1].toUpperCase();

      const terminalMatch = text.match(/\bterminal\s*([A-Za-z0-9]+)\b/i);
      if (terminalMatch) updates.terminal = terminalMatch[1].toUpperCase();

      const delayMatch = text.match(/\bdelayed?\s*(?:by\s*)?([0-9]+\s*(?:min(?:ute)?s?|h(?:ou)?rs?))\b/i);
      if (delayMatch) updates.delay = delayMatch[1];

      if (Object.keys(updates).length > 0) {
        const updateSummary = Object.entries(updates)
          .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
          .join(", ");

        return {
          kind: "update_card",
          targetId: travelCard.id,
          targetTitle: travelCard.title,
          targetListId: travelCard.listId,
          targetIntent: travelCard.intent,
          content: text,
          updates,
          label: `Update "${travelCard.title}" (${updateSummary})`,
        };
      }
    }
  }

  // ── 5. Match "Note on Y: X" or "Thought on Y: X" ───────────────────────
  const noteOnMatch = text.match(
    /^(?:note\s+on|thoughts?\s+on|about|regarding|re:?)\s+([^:]+?):\s*(.+)$/i
  );

  if (noteOnMatch) {
    const entityName = noteOnMatch[1].trim().toLowerCase();
    const content = noteOnMatch[2].trim();

    const matchedCard = existingCards.find(
      (c) =>
        c.title.toLowerCase() === entityName ||
        c.title.toLowerCase().includes(entityName) ||
        entityName.includes(c.title.toLowerCase())
    );

    if (matchedCard) {
      return {
        kind: "attach_to_parent",
        targetId: matchedCard.id,
        targetTitle: matchedCard.title,
        targetListId: matchedCard.listId,
        targetIntent: matchedCard.intent,
        content,
        label: `Attach note to "${matchedCard.title}"`,
      };
    }
  }

  // ── 6. Match "I liked/loved X about/in [Book/Movie] Y" ─────────────────
  const sentimentMatch = text.match(
    /^(?:i\s+)?(?:liked|loved|enjoyed|noticed|found|appreciated)\s+(.+?)\s+(?:in|about)\s+(?:the\s+)?(?:book|movie|album|show|recipe|place)?\s*["']?([^,"'\n.]+?)["']?$/i
  );

  if (sentimentMatch) {
    const aspect = sentimentMatch[1].trim();
    const entityName = sentimentMatch[2].trim().toLowerCase();

    const matchedCard = existingCards.find(
      (c) =>
        c.title.toLowerCase() === entityName ||
        c.title.toLowerCase().includes(entityName) ||
        entityName.includes(c.title.toLowerCase())
    );

    if (matchedCard) {
      return {
        kind: "attach_to_parent",
        targetId: matchedCard.id,
        targetTitle: matchedCard.title,
        targetListId: matchedCard.listId,
        targetIntent: matchedCard.intent,
        content: `Liked ${aspect}`,
        label: `Attach note to "${matchedCard.title}"`,
      };
    }
  }

  // ── 7. Entity Mention check: does text mention any existing card title? ──
  for (const card of existingCards) {
    if (card.title.length >= 4) {
      const lowerTitle = card.title.toLowerCase();
      const lowerText = text.toLowerCase();
      if (lowerText.includes(lowerTitle) && lowerText.length > lowerTitle.length + 5) {
        if (
          /\b(liked|loved|thought|about|note|feedback|review|quote|because|with|for)\b/i.test(
            lowerText
          )
        ) {
          return {
            kind: "attach_to_parent",
            targetId: card.id,
            targetTitle: card.title,
            targetListId: card.listId,
            targetIntent: card.intent,
            content: text,
            label: `Attach to "${card.title}"`,
          };
        }
      }
    }
  }

  return null;
}
