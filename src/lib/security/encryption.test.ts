import { describe, expect, it } from "bun:test";
import { encryptPrivateField, decryptPrivateField, getMasterKey } from "./encryption";

describe("Local Field-Level Encryption Engine", () => {
  it("encrypts and decrypts text cleanly with enc:v1: prefix", () => {
    const original = "Secret memo: buying birthday gift";
    const encrypted = encryptPrivateField(original);
    expect(encrypted).not.toBeNull();
    expect(encrypted?.startsWith("enc:v1:")).toBe(true);
    expect(encrypted).not.toContain(original);

    const decrypted = decryptPrivateField(encrypted);
    expect(decrypted).toBe(original);
  });

  it("handles empty or null/undefined inputs gracefully", () => {
    expect(encryptPrivateField(null)).toBeNull();
    expect(encryptPrivateField(undefined)).toBeNull();
    expect(encryptPrivateField("")).toBeNull();
    expect(decryptPrivateField(null)).toBeNull();
    expect(decryptPrivateField(undefined)).toBeNull();
    expect(decryptPrivateField("")).toBeNull();
  });

  it("preserves unencrypted legacy text containing colons without crashing", () => {
    const legacyText = "Note: remember: milk: and honey: 10:30am";
    const result = decryptPrivateField(legacyText);
    expect(result).toBe(legacyText);
  });

  it("handles malformed or corrupted ciphertext gracefully", () => {
    const malformed1 = "enc:v1:invalidpayload";
    expect(decryptPrivateField(malformed1)).toBe(malformed1);

    const malformed2 = "enc:v1:1234:5678:90ab";
    expect(decryptPrivateField(malformed2)).toBe(malformed2);
  });

  it("fails closed in production if CURIO_MASTER_KEY is missing or invalid", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.CURIO_MASTER_KEY;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.CURIO_MASTER_KEY;

      expect(() => getMasterKey()).toThrow(/SECURITY HALT/);
      expect(() => encryptPrivateField("classified")).toThrow(/SECURITY HALT/);

      // Too short key
      process.env.CURIO_MASTER_KEY = "1234abcd";
      expect(() => getMasterKey()).toThrow(/SECURITY HALT/);

      // Valid 64-char key
      process.env.CURIO_MASTER_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      expect(() => getMasterKey()).not.toThrow();
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalKey !== undefined) {
        process.env.CURIO_MASTER_KEY = originalKey;
      } else {
        delete process.env.CURIO_MASTER_KEY;
      }
    }
  });
});
