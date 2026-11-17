import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { decryptBackupData } from "./backup.js";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(envPath);
  } else {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]!]) {
        process.env[match[1]!] = match[2]?.replace(/^['"](.*)['"]$/, "$1").trim() ?? "";
      }
    }
  }
}

/**
 * Zero-Cost Launch Architecture: Database Restore Utility
 *
 * Requirements:
 * 1. Reads encrypted backup file
 * 2. Unpacks IV, AuthTag, and Ciphertext
 * 3. Decrypts via AES-256-GCM with BACKUP_ENCRYPTION_KEY
 * 4. Restores database via psql
 */

export async function runRestore(targetEncryptedFile?: string) {
  const dbUrl = process.env.DATABASE_URL;
  const encryptionKey =
    process.env.BACKUP_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    "default-backup-key-change-in-production-12345678";

  if (!dbUrl) {
    throw new Error("DATABASE_URL is required to perform database restore");
  }

  const backupDir = path.join(process.cwd(), "backups");
  let fileToRestore = targetEncryptedFile;

  if (!fileToRestore) {
    if (!fs.existsSync(backupDir)) {
      throw new Error("No backups directory found.");
    }
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("hp-backup-") && f.endsWith(".sql.enc"))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error("No backup files found to restore.");
    }
    fileToRestore = path.join(backupDir, files[0]!);
  }

  console.log(`[Restore] Reading backup file: ${fileToRestore}`);
  const packed = fs.readFileSync(fileToRestore);

  // Unpack format: [12 bytes IV][16 bytes AuthTag][Ciphertext]
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);

  console.log(`[Restore] Decrypting AES-256-GCM payload...`);
  const decryptedSql = decryptBackupData(ciphertext, iv, tag, encryptionKey);

  const tempSqlFile = path.join(backupDir, `temp-restore-${Date.now()}.sql`);
  fs.writeFileSync(tempSqlFile, decryptedSql);

  console.log(`[Restore] Restoring database via psql...`);
  try {
    execSync(`psql "${dbUrl}" -f "${tempSqlFile}"`, { stdio: "inherit" });
    console.log(`[Restore] Database successfully restored from ${fileToRestore}!`);
  } finally {
    if (fs.existsSync(tempSqlFile)) {
      fs.unlinkSync(tempSqlFile);
    }
  }
}

if (process.argv[1]?.endsWith("restore.ts") || process.argv[1]?.endsWith("restore.js")) {
  const targetFile = process.argv[2];
  runRestore(targetFile)
    .then(() => {
      console.log("[Restore] Restore operation completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Restore] Restore operation failed:", err);
      process.exit(1);
    });
}
