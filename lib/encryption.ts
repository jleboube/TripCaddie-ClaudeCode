import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  // Decode base64 key or use as-is if already 32 bytes
  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (256 bits) base64 encoded");
  }
  return keyBuffer;
}

export function encryptPII(plaintext: string): string {
  if (!plaintext) return plaintext;

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    // Format: iv:tag:encrypted
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    // In development, return plaintext if encryption fails
    if (process.env.NODE_ENV === "development") {
      return plaintext;
    }
    throw error;
  }
}

export function decryptPII(ciphertext: string): string {
  if (!ciphertext) return ciphertext;

  // Check if it looks like encrypted data (has the : separators)
  if (!ciphertext.includes(":")) {
    return ciphertext; // Return as-is if not encrypted
  }

  try {
    const key = getEncryptionKey();
    const parts = ciphertext.split(":");

    if (parts.length !== 3) {
      return ciphertext; // Return as-is if format doesn't match
    }

    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    // Return original if decryption fails (might be unencrypted data)
    return ciphertext;
  }
}

export function hashEmail(email: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
}
