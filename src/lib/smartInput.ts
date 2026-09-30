export type SmartActionKind =
  | "append_card"       // e.g. "add milk to groceries"
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
  label: string;
}

/**
 * Parses input text to detect commands like:
 * - "add X to Y" (append to card or list)
 * - "note on Y: X" or "I liked X about book Y" (attach to parent card)
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
      // Split items by comma or 'and'
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

  // ── 2. Match "Note on Y: X" or "Thought on Y: X" ───────────────────────
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

  // ── 3. Match "I liked/loved X about/in [Book/Movie] Y" ─────────────────
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

  // ── 4. Entity Mention check: does text mention any existing card title? ──
  for (const card of existingCards) {
    if (card.title.length >= 4) {
      const lowerTitle = card.title.toLowerCase();
      const lowerText = text.toLowerCase();
      // Check if title is mentioned as a distinct entity
      if (lowerText.includes(lowerTitle) && lowerText.length > lowerTitle.length + 5) {
        // Only trigger if text contains sentiment, note, or relationship words
        if (
          /\b(liked|loved|thought|about|note|feedback|review|quote|because|with|for)\b/i.test(
            lowerText
          )
        ) {
          const noteContent = text.replace(new RegExp(card.title, "i"), "").trim();
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
