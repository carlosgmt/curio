import { capitalize, collapse } from "./common";

export type TodoData = { items: string[]; verb: string | null };

export function parseTodo(text: string): TodoData {
  let rest = collapse(text.replace(/\n/g, ", "));
  rest = rest.replace(
    /^(?:to ?do|todo list|list|shopping list|groceries|lista de la compra|supermercado|super|tareas|lista|compra)\b\s*:?\s*/i,
    ""
  );
  let verb: string | null = null;
  const vm = rest.match(/^(add|buy|get|pick up|grab|order|añadir|agregar|poner|comprar|pedir|coger|traer)\s+/i);
  if (vm) {
    verb = vm[1].toLowerCase();
    rest = rest.slice(vm[0].length);
  }
  const items = rest
    .split(/\s*(?:,|;|\s&\s|\band\b|\by\b|\be\b|\n)\s*/i)
    .map((s) =>
      s
        .trim()
        .replace(/^(?:add|buy|get|also|añadir|agregar|poner|comprar|también|tambien)\s+/i, "")
        .replace(/[.!]+$/, "")
    )
    .filter(Boolean)
    .map(capitalize);
  return { items, verb };
}

export function completeTodo(d: TodoData) {
  return Math.min(1, d.items.length / 3);
}
