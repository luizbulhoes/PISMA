#!/usr/bin/env bash
# Backup lógico PostgreSQL — PISMA
set -euo pipefail
STAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR=${1:-./backups}
mkdir -p "$OUT_DIR"
pg_dump "$DATABASE_URL" | gzip > "$OUT_DIR/pisma_${STAMP}.sql.gz"
echo "backup: $OUT_DIR/pisma_${STAMP}.sql.gz"
