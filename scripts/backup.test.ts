import { describe, it, expect } from "vitest";
import { encryptBackupData, decryptBackupData } from "./backup.js";

describe("Backup Encryption and Decryption Routine", () => {
  const secretKey = "super-secret-backup-encryption-key-32-chars";

  it("encrypts and decrypts database dump data with zero loss", () => {
    const rawSql = Buffer.from(
      "CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);\nINSERT INTO users VALUES ('1', 'creator@hyperprofile.com');",
      "utf8",
    );

    const { encrypted, iv, tag, checksum } = encryptBackupData(rawSql, secretKey);

    expect(encrypted).toBeDefined();
    expect(encrypted.length).toBeGreaterThan(0);
    expect(iv.length).toBe(12);
    expect(tag.length).toBe(16);
    expect(checksum).toHaveLength(64);

    const decrypted = decryptBackupData(encrypted, iv, tag, secretKey);
    expect(decrypted.toString("utf8")).toBe(rawSql.toString("utf8"));
  });

  it("fails decryption if incorrect encryption key is provided", () => {
    const rawSql = Buffer.from("DUMP DATA", "utf8");
    const { encrypted, iv, tag } = encryptBackupData(rawSql, secretKey);

    expect(() => {
      decryptBackupData(encrypted, iv, tag, "wrong-encryption-key-123456789012");
    }).toThrow();
  });

  it("fails decryption if payload or auth tag is tampered with", () => {
    const rawSql = Buffer.from("DUMP DATA", "utf8");
    const { encrypted, iv, tag } = encryptBackupData(rawSql, secretKey);

    // Tamper with one byte of ciphertext
    encrypted[0] = (encrypted[0]! ^ 0xff);

    expect(() => {
      decryptBackupData(encrypted, iv, tag, secretKey);
    }).toThrow();
  });
});
