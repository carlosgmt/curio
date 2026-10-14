import { describe, it, expect } from "bun:test";
import { isBrainDump, splitBrainDump } from "../brainDump";

describe("brainDump splitter", () => {
  it("detects multi-line brain dump", () => {
    const text = `Buy milk
Call dentist
Read Norwegian Wood`;
    expect(isBrainDump(text)).toBe(true);
    expect(splitBrainDump(text)).toEqual([
      "Buy milk",
      "Call dentist",
      "Read Norwegian Wood",
    ]);
  });

  it("cleans bullet points, checkboxes, and numbered lists", () => {
    const text = `- Buy sourdough bread
* Call electrician
• 15% of 250
1. Book flight to Zurich
[ ] Workout at 6pm
[x] Finished task`;
    expect(isBrainDump(text)).toBe(true);
    expect(splitBrainDump(text)).toEqual([
      "Buy sourdough bread",
      "Call electrician",
      "15% of 250",
      "Book flight to Zurich",
      "Workout at 6pm",
      "Finished task",
    ]);
  });

  it("rejects single line text", () => {
    expect(isBrainDump("Buy milk and eggs")).toBe(false);
    expect(splitBrainDump("Buy milk and eggs")).toEqual(["Buy milk and eggs"]);
  });

  it("handles blank lines and whitespace gracefully", () => {
    const text = `
    First item
    
    Second item
    
    `;
    expect(isBrainDump(text)).toBe(true);
    expect(splitBrainDump(text)).toEqual(["First item", "Second item"]);
  });
});
