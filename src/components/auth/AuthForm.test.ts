import { describe, expect, it } from "bun:test";
import { sanitizeReturnUrl } from "./AuthForm";

describe("AuthForm & Navigation Logic", () => {
  describe("ReturnUrl Sanitization (Open-Redirect Prevention)", () => {
    it("allows valid relative subpaths", () => {
      expect(sanitizeReturnUrl("/curio/list/tokyo-guide")).toBe("/curio/list/tokyo-guide");
      expect(sanitizeReturnUrl("/card/12345")).toBe("/card/12345");
      expect(sanitizeReturnUrl("/")).toBe("/");
    });

    it("rejects malicious open redirect vectors", () => {
      expect(sanitizeReturnUrl("//evil.com")).toBe("/");
      expect(sanitizeReturnUrl("https://phishing.com/steal")).toBe("/");
      expect(sanitizeReturnUrl("http://attacker.com")).toBe("/");
      expect(sanitizeReturnUrl("javascript:alert(1)")).toBe("/");
      expect(sanitizeReturnUrl(null)).toBe("/");
      expect(sanitizeReturnUrl(undefined)).toBe("/");
    });
  });
});
