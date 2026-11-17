#!/usr/bin/env bash
# Backup do banco: pg_dump → valida → criptografa → envia ao R2 → apaga cópias antigas.
# Variáveis: DATABASE_URL, BACKUP_PASSPHRASE, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
YEAR="$(date -u +%Y)"
MONTH="$(date -u +%m)"
DAY="$(date -u +%d)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

NAME="firmus-${STAMP}"
DUMP="$WORK/${NAME}.dump"
META="$WORK/${NAME}.meta.json"

echo "1/5 Gerando dump do banco…"
pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname="$DATABASE_URL" --file="$DUMP"

echo "2/5 Validando o dump…"
pg_restore --list "$DUMP" > "$WORK/toc.txt"
TABLES="$(grep -c ' TABLE DATA ' "$WORK/toc.txt" || true)"
SIZE="$(stat -c %s "$DUMP")"
# Um banco com poucas tabelas ou um arquivo minúsculo é sinal de dump quebrado: falha em vez de guardar lixo.
if [ "$TABLES" -lt 25 ]; then echo "ERRO: dump com apenas $TABLES tabelas (esperado 25 ou mais)."; exit 1; fi
if [ "$SIZE" -lt 20000 ]; then echo "ERRO: dump com apenas $SIZE bytes (suspeito)."; exit 1; fi

# Contagens no momento do backup: servem para a verificação mensal de restauração.
# (Ficam sem criptografia, mas são só números — nenhum dado de cliente.)
psql "$DATABASE_URL" -At -c "select json_build_object(
  'takenAt', now(),
  'tables', $TABLES,
  'counts', json_build_object(
    'transactions', (select count(*) from transactions),
    'properties',   (select count(*) from properties),
    'users',        (select count(*) from users),
    'migrations',   (select count(*) from _prisma_migrations)
  ))" > "$META"

echo "3/5 Criptografando…"
encrypt_file "$DUMP" "$DUMP.enc"

KEY="db/${YEAR}/${MONTH}/${NAME}"
echo "4/5 Enviando ao R2…"
r2 s3 cp "$DUMP.enc" "s3://${R2_BUCKET}/${KEY}.dump.enc" --only-show-errors
r2 s3 cp "$META" "s3://${R2_BUCKET}/${KEY}.meta.json" --only-show-errors

# Confere que o arquivo chegou com o mesmo tamanho.
REMOTE_SIZE="$(r2 s3api head-object --bucket "$R2_BUCKET" --key "${KEY}.dump.enc" --query ContentLength --output text)"
LOCAL_SIZE="$(stat -c %s "$DUMP.enc")"
if [ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]; then echo "ERRO: tamanho no R2 ($REMOTE_SIZE) difere do local ($LOCAL_SIZE)."; exit 1; fi

# Todo dia 1º, guarda uma cópia mensal (retenção longa).
if [ "$DAY" = "01" ]; then
  r2 s3 cp "s3://${R2_BUCKET}/${KEY}.dump.enc" "s3://${R2_BUCKET}/monthly/${NAME}.dump.enc" --only-show-errors
  r2 s3 cp "s3://${R2_BUCKET}/${KEY}.meta.json" "s3://${R2_BUCKET}/monthly/${NAME}.meta.json" --only-show-errors
fi

echo "5/5 Limpando cópias antigas…"
bash "$HERE/prune.sh"

echo "Backup concluído: ${NAME} ($((SIZE / 1024)) KB compactado, ${TABLES} tabelas)."
