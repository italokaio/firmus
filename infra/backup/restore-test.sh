#!/usr/bin/env bash
# Prova que o backup funciona: baixa o backup mais recente, descriptografa, restaura em um Postgres
# VAZIO e confere as contagens. Só imprime "OK"/"ERRO" — sem números nem dados (log público).
# Variáveis: TEST_DATABASE_URL (banco descartável), BACKUP_PASSPHRASE e as do lib.sh.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"
: "${TEST_DATABASE_URL:?defina TEST_DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

LATEST="$(r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "db/" \
  --query "sort_by(Contents[?ends_with(Key, '.dump.enc')], &LastModified)[-1].Key" --output text 2>/dev/null || echo None)"
if [ -z "$LATEST" ] || [ "$LATEST" = "None" ]; then echo "ERRO: nenhum backup encontrado no bucket."; exit 1; fi
echo "Testando o backup mais recente (${LATEST##*/})…"

r2 s3 cp "s3://${R2_BUCKET}/${LATEST}" "$WORK/backup.dump.enc" --only-show-errors
r2 s3 cp "s3://${R2_BUCKET}/${LATEST%.dump.enc}.meta.json" "$WORK/meta.json" --only-show-errors

decrypt_file "$WORK/backup.dump.enc" "$WORK/backup.dump" || { echo "ERRO: não foi possível descriptografar (senha errada?)."; exit 1; }
# --clean --if-exists: o resultado não depende de o dump trazer (ou não) o schema public.
pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --dbname="$TEST_DATABASE_URL" "$WORK/backup.dump"

FAILED=0
for table in transactions properties users _prisma_migrations; do
  case "$table" in
    _prisma_migrations) key="migrations" ;;
    *) key="$table" ;;
  esac
  expected="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WORK/meta.json','utf8')).counts['$key'])")"
  actual="$(psql "$TEST_DATABASE_URL" -At -c "select count(*) from \"$table\"")"
  # O backup é feito logo depois das contagens: pode ter MAIS linhas, nunca menos.
  if [ "$actual" -lt "$expected" ] || [ "$actual" -le 0 ]; then
    echo "ERRO: a tabela ${table} voltou com menos linhas do que o esperado."
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then exit 1; fi
echo "OK: backup restaurado em um banco vazio e as contagens conferem."
