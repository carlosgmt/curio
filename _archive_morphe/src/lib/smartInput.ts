export type SmartActionKind =
  | "append_card"       // e.g. "add milk to groceries", "add milk", "añadir leche", "groceries: eggs"
  | "update_card"       // e.g. "flight gate 12B, seat 14A", "vuelo puerta 12B"
  | "create_in_list"    // e.g. "add buy tickets to tasks", "poner comprar entradas en tareas"
  | "attach_to_parent"  // e.g. "I liked the ending of Norwegian Wood", "nota sobre Interstellar: ..."
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

function splitItems(raw: string): string[] {
  return raw
    .split(/[,;\n]|\s+(?:and|y|e)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parses input text in real time across English and Spanish to detect:
 * 1. "add X to Y" / "añadir X a Y" (append items to specific card or list)
 * 2. "add X" / "añadir X" / "falta X" / "also need X" (append to active grocery / todo card)
 * 3. "CardTitle: item1, item2" (prefix-based append)
 * 4. "flight gate 12B, seat 14A" / "vuelo puerta 12B" (update registered travel card)
 * 5. "note on Y: X" / "nota sobre Y: X" (attach child note to parent card)
 */
export function analyzeSmartInput(
  rawText: string,
  existingCards: Array<{ id: string; title: string; intent: string; listId: string; data?: any }>,
  existingLists: Array<{ id: string; name: string }>
): SmartActionTarget | null {
  const text = rawText.trim();
  if (text.length < 3) return null;

  // Candidate todo / groceries card for item additions
  const candidateTodo =
    existingCards.find((c) =>
      /(?:groceries|grocery|shopping|supermercado|super|compra|compras|kitchen|cocina|despensa|market|mercado|tareas|tasks|todo)/i.test(
        c.title
      )
    ) ||
    existingCards.find((c) => c.intent === "todo" || Array.isArray(c.data?.items)) ||
    existingCards.find((c) => c.listId === "tasks" || c.listId === "kitchen");

  // ── 1. Match "add X to Y" / "añadir X a Y" pattern (EN and ES) ─────────
  const addMatch = text.match(
    /^(?:add|put|include|insert|añadir|agregar|poner|meter|incluir)\s+(.+?)\s+(?:to|in|into|on|a|al|en|para)\s+(?:the\s+|la\s+|el\s+)?(.+?)(?:\s+list|\s+card|\s+lista|\s+tarjeta)?$/i
  );

  if (addMatch) {
    const content = addMatch[1].trim();
    const targetName = addMatch[2].trim().toLowerCase();

    // Check if target matches an existing card (e.g. "Groceries", "Shopping", "Supermercado")
    const matchedCard = existingCards.find(
      (c) =>
        c.title.toLowerCase() === targetName ||
        c.title.toLowerCase().includes(targetName) ||
        targetName.includes(c.title.toLowerCase())
    );

    if (matchedCard) {
      const items = splitItems(content);
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

    // Check if target matches an existing list (e.g. "Tasks", "Kitchen", "Tareas")
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

    // Fallback: If targetName refers to groceries/shopping, match candidateTodo
    if (candidateTodo && /(?:groceries|grocery|shopping|supermercado|super|compra|compras|despensa|market|mercado|food|comida)/i.test(targetName)) {
      const items = splitItems(content);
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

  // ── 1b. Direct "X to Y" without "add" verb (e.g. "milk to groceries", "leche a la compra") ──
  const directToMatch = text.match(
    /^(.+?)\s+(?:to|in|into|a|al|en|para)\s+(?:the\s+|la\s+|el\s+)?(groceries|grocery|shopping|compra|compras|supermercado|super|despensa|kitchen|tasks|tareas)(?:\s+list|\s+lista)?$/i
  );

  if (directToMatch && candidateTodo) {
    const content = directToMatch[1].trim();
    if (content.length > 0 && !content.endsWith("?") && content.split(/\s+/).length <= 8) {
      const items = splitItems(content);
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

  // ── 2. Standalone item addition: "add milk", "añadir leche", "falta mantequilla", "also need coffee" ──
  const standaloneAddMatch = text.match(
    /^(?:add|put|include|insert|also(?:\s+(?:need|buy|get|grab|pick up))?|and\s+also(?:\s+(?:need|buy|get|grab))?|añadir|agregar|poner|meter|también(?:\s+(?:necesito|comprar))?|tambien|y\s+también|y\s+tambien|falta|faltan|necesito|necesitamos|comprar|buy|get|grab)\s+(.+)$/i
  );

  if (standaloneAddMatch && candidateTodo) {
    let content = standaloneAddMatch[1].trim();
    content = content.replace(/^(?:need|buy|get|grab|necesito|comprar)\s+/i, "").trim();
    // Do not trigger if user is clearly writing a long complex sentence or question
    if (content.length > 0 && !content.endsWith("?") && content.split(/\s+/).length <= 10) {
      const items = splitItems(content);
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
  const colonPrefixMatch = text.match(/^([a-zA-Z0-9ñáéíóú\s]{2,}?):\s*(.+)$/i);
  if (colonPrefixMatch) {
    const prefix = colonPrefixMatch[1].trim().toLowerCase();
    const rawItems = colonPrefixMatch[2].trim();

    const matchedCard = existingCards.find(
      (c) =>
        (c.intent === "todo" || Array.isArray(c.data?.items)) &&
        (c.title.toLowerCase() === prefix || c.title.toLowerCase().startsWith(prefix))
    );

    if (matchedCard) {
      const items = splitItems(rawItems);
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

  // ── 4. Match Flight / Travel updates (gate, seat, terminal, delay) in EN and ES ──────
  const flightUpdateCues = /\b(gate|seat|terminal|delay(?:ed)?|boarding|puerta|asiento|retraso|retrasado|embarque)\b/i;
  if (flightUpdateCues.test(text)) {
    const travelCard =
      existingCards.find((c) => c.intent === "travel") ||
      existingCards.find((c) => /flight|trip|travel|vuelo|viaje/i.test(c.title));

    if (travelCard) {
      const updates: Record<string, any> = {};

      const gateMatch = text.match(/\b(?:gate|puerta)\s*([A-Za-z0-9]+)\b/i);
      if (gateMatch) updates.gate = gateMatch[1].toUpperCase();

      const seatMatch = text.match(/\b(?:seat|asiento)\s*([A-Za-z0-9]+)\b/i);
      if (seatMatch) updates.seat = seatMatch[1].toUpperCase();

      const terminalMatch = text.match(/\b(?:terminal)\s*([A-Za-z0-9]+)\b/i);
      if (terminalMatch) updates.terminal = terminalMatch[1].toUpperCase();

      const delayMatch = text.match(
        /\b(?:delayed?|retrasado?)\s*(?:by|de)?\s*([0-9]+\s*(?:min(?:ute)?s?|h(?:ou)?rs?|minutos?|horas?))\b/i
      );
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

  // ── 5. Match "Note on Y: X" / "Nota sobre Y: X" ────────────────────────
  const noteOnMatch = text.match(
    /^(?:note\s+on|thoughts?\s+on|about|regarding|re:?|nota\s+sobre|pensamiento\s+sobre|sobre)\s+([^:]+?):\s*(.+)$/i
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

  // ── 6. Match "I liked/loved X about/in [Book/Movie] Y" (EN and ES) ─────
  const sentimentMatch = text.match(
    /^(?:i\s+)?(?:liked|loved|enjoyed|noticed|found|appreciated|me\s+gustó|me\s+gusto|me\s+encantó|me\s+encanto)\s+(.+?)\s+(?:in|about|de|en)\s+(?:the\s+|el\s+|la\s+)?(?:book|movie|album|show|recipe|place|libro|película|pelicula)?\s*["']?([^,"'\n.]+?)["']?$/i
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
          /\b(liked|loved|thought|about|note|feedback|review|quote|because|with|for|gustó|gusto|encantó|encanto|nota|opinión|opinion)\b/i.test(
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
