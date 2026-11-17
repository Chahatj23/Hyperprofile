#!/usr/bin/env bash
set -euo pipefail

# Zero-Cost Architecture: Postgres Restore Drill Utility

TARGET_ENC="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [ -z "${TARGET_ENC}" ]; then
  TARGET_ENC=$(ls -t "${BACKUP_DIR}"/hp-backup-*.sql.enc 2>/dev/null | head -n 1 || true)
fi

if [ -z "${TARGET_ENC}" ] || [ ! -f "${TARGET_ENC}" ]; then
  echo "Error: No backup file found to restore." >&2
  exit 1
fi

TEMP_SQL="${BACKUP_DIR}/temp-restore-$$.sql"
trap 'rm -f "${TEMP_SQL}"' EXIT

echo "[$(date -u)] Decrypting ${TARGET_ENC}..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:${BACKUP_ENCRYPTION_KEY}" -in "${TARGET_ENC}" -out "${TEMP_SQL}"

echo "[$(date -u)] Restoring database via psql..."
psql "${DATABASE_URL}" -f "${TEMP_SQL}"
echo "[$(date -u)] Restore completed successfully!"
