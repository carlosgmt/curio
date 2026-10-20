import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

export function getMasterKey(): Buffer {
  const envKey = process.env.CURIO_MASTER_KEY;
  if (process.env.NODE_ENV === "production") {
    if (!envKey || envKey.length < 64) {
      throw new Error("SECURITY HALT: CURIO_MASTER_KEY must be a 64-character hex string (32 bytes) in production.");
    }
    return Buffer.from(envKey, "hex");
  }
  // Safe test/dev fallback derived deterministically
  return envKey
    ? Buffer.from(envKey.padEnd(64, "0").slice(0, 64), "hex")
    : createHash("sha256").update("curio-dev-master-key-seed").digest();
}

export function encryptPrivateField(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const masterKey = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPrivateField(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  // If not versioned ciphertext, return as-is (preserves unencrypted legacy text containing colons)
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  try {
    const masterKey = getMasterKey();
    const raw = ciphertext.slice(PREFIX.length);
    const parts = raw.split(":");
    if (parts.length !== 3) return ciphertext;
    const [ivHex, tagHex, dataHex] = parts;
    if (ivHex.length !== 24 || tagHex.length !== 32 || !dataHex) return ciphertext;

    const decipher = createDecipheriv(ALGORITHM, masterKey, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8");
  } catch {
    // If decryption or tag verification fails, return raw string gracefully without crashing
    return ciphertext;
  }
}
