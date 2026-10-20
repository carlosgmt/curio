import { describe, expect, it } from "bun:test";
import { CURIO_SPRINGS } from "./springs";

describe("Motion Spring Configuration (FR-2.0 / Motion)", () => {
  it("asserts all spring damping ratios are >= 20 preventing underdamped oscillation", () => {
    const springKeys = Object.keys(CURIO_SPRINGS);
    expect(springKeys.length).toBeGreaterThanOrEqual(4);

    for (const key of springKeys) {
      const spring = CURIO_SPRINGS[key];
      expect(spring.type).toBe("spring");
      expect(spring.stiffness).toBeGreaterThan(0);
      expect(spring.damping).toBeGreaterThanOrEqual(20);
    }
  });
});
