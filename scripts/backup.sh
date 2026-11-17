#!/usr/bin/env bash
set -euo pipefail

# Zero-Cost Architecture: Nightly Encrypted Postgres Backup to Cloudflare R2
# Runs in GitHub Actions nightly at 02:00 UTC

TIMESTAMP=$(date -u +"%Y-%m-%d-%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${BACKUP_DIR}"

RAW_FILE="${BACKUP_DIR}/dump-${TIMESTAMP}.sql"
ENC_FILE="${BACKUP_DIR}/hp-backup-${TIMESTAMP}.sql.enc"

echo "[$(date -u)] Starting pg_dump..."
pg_dump "${DATABASE_URL}" --no-owner --no-privileges -f "${RAW_FILE}"

echo "[$(date -u)] Encrypting with AES-256-CBC and PBKDF2..."
openssl enc -aes-256-cbc -salt -pbkdf2 -pass "pass:${BACKUP_ENCRYPTION_KEY}" -in "${RAW_FILE}" -out "${ENC_FILE}"
rm -f "${RAW_FILE}"

SHA256=$(sha256sum "${ENC_FILE}" | awk '{print $1}')
echo "[$(date -u)] Encrypted backup created: ${ENC_FILE} (SHA-256: ${SHA256})"

if [ -n "${R2_BUCKET_NAME:-}" ] && [ -n "${R2_ENDPOINT:-}" ]; then
  echo "[$(date -u)] Uploading to Cloudflare R2..."
  aws s3 cp "${ENC_FILE}" "s3://${R2_BUCKET_NAME}/backups/hp-backup-${TIMESTAMP}.sql.enc" --endpoint-url "${R2_ENDPOINT}"
  echo "[$(date -u)] Upload to R2 completed."
fi

echo "[$(date -u)] Pruning backups older than 14 days..."
find "${BACKUP_DIR}" -name "hp-backup-*.sql.enc" -type f -mtime +14 -delete
echo "[$(date -u)] Backup routine completed successfully."
