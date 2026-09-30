import { describe, it, expect } from "bun:test";
import { analyzeSmartInput } from "../smartInput";

describe("smartInput parser", () => {
  const cards = [
    {
      id: "card-1",
      title: "Groceries",
      intent: "todo",
      listId: "kitchen",
      data: { items: [{ id: "i1", text: "apples", done: false }] },
    },
    {
      id: "card-2",
      title: "Norwegian Wood",
      intent: "book",
      listId: "notes",
      data: { author: "Haruki Murakami" },
    },
    {
      id: "card-3",
      title: "Interstellar",
      intent: "movie",
      listId: "inbox",
      data: { director: "Christopher Nolan" },
    },
  ];

  const lists = [
    { id: "inbox", name: "Inbox" },
    { id: "tasks", name: "Tasks" },
    { id: "kitchen", name: "Kitchen" },
    { id: "notes", name: "Notes" },
  ];

  it("matches 'add X to groceries' and extracts items", () => {
    const res = analyzeSmartInput("add milk, eggs and sourdough to groceries", cards, lists);
    expect(res).not.toBeNull();
    expect(res?.kind).toBe("append_card");
    expect(res?.targetId).toBe("card-1");
    expect(res?.itemsToAppend).toEqual(["milk", "eggs", "sourdough"]);
    expect(res?.label).toContain('Append to "Groceries"');
  });

  it("matches 'put X in Y list' to route to a list", () => {
    const res = analyzeSmartInput("put fix leaking tap in tasks list", cards, lists);
    expect(res).not.toBeNull();
    expect(res?.kind).toBe("create_in_list");
    expect(res?.targetListId).toBe("tasks");
    expect(res?.content).toBe("fix leaking tap");
    expect(res?.label).toContain("Add to Tasks list");
  });

  it("matches 'I liked X about [Book] Y' and attaches to parent", () => {
    const res = analyzeSmartInput(
      "I liked the bittersweet ending about book Norwegian Wood",
      cards,
      lists
    );
    expect(res).not.toBeNull();
    expect(res?.kind).toBe("attach_to_parent");
    expect(res?.targetId).toBe("card-2");
    expect(res?.label).toContain('Attach note to "Norwegian Wood"');
  });

  it("matches 'note on Y: X' and attaches note to parent", () => {
    const res = analyzeSmartInput(
      "note on Interstellar: docking scene soundtrack is phenomenal",
      cards,
      lists
    );
    expect(res).not.toBeNull();
    expect(res?.kind).toBe("attach_to_parent");
    expect(res?.targetId).toBe("card-3");
    expect(res?.content).toBe("docking scene soundtrack is phenomenal");
  });

  it("returns null for ordinary new card input", () => {
    const res = analyzeSmartInput("dinner with Priya at 8pm tomorrow", cards, lists);
    expect(res).toBeNull();
  });
});
