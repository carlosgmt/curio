import { describe, it, expect } from "bun:test";
import { mockClassify } from "../jev/mock";
import { analyzeSmartInput } from "../smartInput";
import { parseReminder } from "../parse/reminder";
import { parseTodo } from "../parse/todo";
import { parseEvent } from "../parse/event";

describe("Bilingual EN and ES classification and smart actions", () => {
  const existingCards = [
    {
      id: "card-groceries",
      title: "Groceries",
      intent: "todo",
      listId: "kitchen",
      data: { items: [{ id: "i1", text: "Apples", done: false }] },
    },
    {
      id: "card-flight",
      title: "Flight to Barcelona",
      intent: "travel",
      listId: "calendar",
      data: { destination: "Barcelona" },
    },
  ];
  const existingLists = [
    { id: "inbox", name: "Inbox" },
    { id: "tasks", name: "Tasks" },
    { id: "kitchen", name: "Kitchen" },
  ];

  describe("Reminders across EN and ES", () => {
    it("classifies 'alquilar coche' as reminder", () => {
      const res = mockClassify("alquilar coche");
      expect(res.intent.value).toBe("reminder");
    });

    it("classifies 'rent a car' as reminder", () => {
      const res = mockClassify("rent a car");
      expect(res.intent.value).toBe("reminder");
    });

    it("classifies 'recuérdame llamar a mamá mañana' as reminder", () => {
      const res = mockClassify("recuérdame llamar a mamá mañana");
      expect(res.intent.value).toBe("reminder");
    });

    it("classifies 'recordar pagar el alquiler' as reminder", () => {
      const res = mockClassify("recordar pagar el alquiler");
      expect(res.intent.value).toBe("reminder");
    });

    it("classifies 'alquilar coche para granada' as reminder", () => {
      const res = mockClassify("alquilar coche para granada");
      expect(res.intent.value).toBe("reminder");
    });

    it("classifies 'tengo que alquilar coche' as reminder and parses clean task", () => {
      const res = mockClassify("tengo que alquilar coche");
      expect(res.intent.value).toBe("reminder");
      const parsed = parseReminder("tengo que alquilar coche");
      expect(parsed.task).toBe("Alquilar coche");
    });

    it("classifies 'hay que llamar al médico' as reminder and parses clean task", () => {
      const res = mockClassify("hay que llamar al médico");
      expect(res.intent.value).toBe("reminder");
      const parsed = parseReminder("hay que llamar al médico");
      expect(parsed.task).toBe("Llamar al médico");
    });

    it("classifies 'i need to rent a car' as reminder and parses clean task", () => {
      const res = mockClassify("i need to rent a car");
      expect(res.intent.value).toBe("reminder");
      const parsed = parseReminder("i need to rent a car");
      expect(parsed.task).toBe("Rent a car");
    });

    it("parses reminder task for 'alquilar coche'", () => {
      const parsed = parseReminder("alquilar coche");
      expect(parsed.task.toLowerCase()).toContain("alquilar coche");
    });

    it("parses reminder with Spanish date 'recuérdame llamar a Juan mañana'", () => {
      const parsed = parseReminder("recuérdame llamar a Juan mañana");
      expect(parsed.task.toLowerCase()).toContain("llamar a juan");
      expect(parsed.when).not.toBeNull();
    });
  });

  describe("Smart Input: add milk -> Groceries append", () => {
    it("matches 'add milk' and appends to existing Groceries card", () => {
      const action = analyzeSmartInput("add milk", existingCards, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-groceries");
      expect(action?.itemsToAppend).toEqual(["milk"]);
    });

    it("matches 'añadir leche' and appends to existing Groceries card", () => {
      const action = analyzeSmartInput("añadir leche", existingCards, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-groceries");
      expect(action?.itemsToAppend).toEqual(["leche"]);
    });

    it("matches 'falta mantequilla' and appends to existing Groceries card", () => {
      const action = analyzeSmartInput("falta mantequilla", existingCards, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-groceries");
      expect(action?.itemsToAppend).toEqual(["mantequilla"]);
    });

    it("matches 'comprar leche y huevos' and appends multiple items", () => {
      const action = analyzeSmartInput("comprar leche y huevos", existingCards, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-groceries");
      expect(action?.itemsToAppend).toEqual(["leche", "huevos"]);
    });

    it("matches explicit 'añadir pan a la lista de groceries'", () => {
      const action = analyzeSmartInput("añadir pan a groceries", existingCards, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-groceries");
      expect(action?.itemsToAppend).toEqual(["pan"]);
    });

    it("matches 'add milk' even if todo card has generated title like '2 items · Eggs, Butter'", () => {
      const cardsWithGeneratedTitle = [
        {
          id: "card-todos",
          title: "2 items · Eggs, Butter",
          intent: "todo",
          listId: "inbox",
          data: { items: ["Eggs", "Butter"] },
        },
      ];
      const action = analyzeSmartInput("add milk", cardsWithGeneratedTitle, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-todos");
      expect(action?.itemsToAppend).toEqual(["milk"]);
    });

    it("matches 'add milk to groceries' even when existing card title is '2 items · Eggs, Butter'", () => {
      const cardsWithGeneratedTitle = [
        {
          id: "card-todos",
          title: "2 items · Eggs, Butter",
          intent: "todo",
          listId: "inbox",
          data: { items: ["Eggs", "Butter"] },
        },
      ];
      const action = analyzeSmartInput("add milk to groceries", cardsWithGeneratedTitle, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-todos");
      expect(action?.itemsToAppend).toEqual(["milk"]);
    });

    it("matches direct 'milk to groceries' pattern", () => {
      const action = analyzeSmartInput("milk to groceries", existingCards, existingLists);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("append_card");
      expect(action?.targetId).toBe("card-groceries");
      expect(action?.itemsToAppend).toEqual(["milk"]);
    });
  });

  describe("Todo lists across EN and ES", () => {
    it("classifies 'comprar leche, huevos y pan' as todo", () => {
      const res = mockClassify("comprar leche, huevos y pan");
      expect(res.intent.value).toBe("todo");
    });

    it("parses Spanish list items split by 'y'", () => {
      const parsed = parseTodo("comprar leche, huevos y pan");
      expect(parsed.items).toEqual(["Leche", "Huevos", "Pan"]);
    });
  });

  describe("Events across EN and ES", () => {
    it("classifies 'cena con María mañana a las 21:00' as event", () => {
      const res = mockClassify("cena con María mañana a las 21:00");
      expect(res.intent.value).toBe("event");
    });

    it("parses Spanish event date and attendees", () => {
      const parsed = parseEvent("cena con María mañana a las 21:00");
      expect(parsed.title.toLowerCase()).toContain("cena");
      expect(parsed.people).toContain("María");
      expect(parsed.date).not.toBeNull();
      expect(parsed.hasTime).toBe(true);
    });
  });

  describe("Expenses across EN and ES", () => {
    it("classifies 'gasté 35 euros en uber' as expense", () => {
      const res = mockClassify("gasté 35 euros en uber");
      expect(res.intent.value).toBe("expense");
    });

    it("classifies 'pagué 50€' as expense", () => {
      const res = mockClassify("pagué 50€");
      expect(res.intent.value).toBe("expense");
    });
  });

  describe("Travel across EN and ES", () => {
    it("classifies 'vuelo a Roma el próximo fin de semana' as travel", () => {
      const res = mockClassify("vuelo a Roma el próximo fin de semana");
      expect(res.intent.value).toBe("travel");
    });
  });
});
