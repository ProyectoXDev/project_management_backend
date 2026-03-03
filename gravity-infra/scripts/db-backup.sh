#!/bin/bash
# Automated PostgreSQL backup to local volume (or S3 in prod)
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="gravity_backup_${TIMESTAMP}.sql"
BACKUP_DIR="/backups"

mkdir -p "${BACKUP_DIR}"

echo "📦 Starting backup: ${BACKUP_FILE}"
PGPASSWORD="${DB_PASSWORD:-gravity_pass}" pg_dump \
  -h "${DB_HOST:-postgres}" \
  -U "${DB_USER:-gravity_user}" \
  -d "${DB_NAME:-gravity_db}" \
  --no-owner \
  --no-acl \
  > "${BACKUP_DIR}/${BACKUP_FILE}"

gzip "${BACKUP_DIR}/${BACKUP_FILE}"
echo "✅ Backup complete: ${BACKUP_FILE}.gz"

# Optional S3 upload
if [ -n "${AWS_BUCKET:-}" ]; then
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" "s3://${AWS_BUCKET}/backups/${BACKUP_FILE}.gz"
  echo "☁️  Uploaded to s3://${AWS_BUCKET}/backups/${BACKUP_FILE}.gz"
fi

# Prune backups older than 30 days
find "${BACKUP_DIR}" -name "*.gz" -mtime +30 -delete
echo "🧹 Old backups pruned"
