#!/usr/bin/env bash
# Apaga backups antigos do R2: diários (db/) com mais de 30 dias e mensais (monthly/) com mais de 400.
# Trava de segurança: nunca apaga se sobrariam menos de 7 cópias (protege contra relógio errado ou bug).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

DAILY_DAYS="${DAILY_RETENTION_DAYS:-30}"
MONTHLY_DAYS="${MONTHLY_RETENTION_DAYS:-400}"
MIN_KEEP=7

prune() {
  local prefix="$1" days="$2" cutoff total old remaining
  cutoff="$(date -u -d "-${days} days" +%Y-%m-%dT%H:%M:%SZ)"

  total="$(r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "$prefix" \
    --query "length(Contents[?ends_with(Key, '.dump.enc')])" --output text 2>/dev/null || echo 0)"
  [ "$total" = "None" ] && total=0
  old="$(r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "$prefix" \
    --query "Contents[?LastModified<'${cutoff}'].Key" --output text)"
  if [ -z "$old" ] || [ "$old" = "None" ]; then echo "  ${prefix}: nada para apagar (${total} backup(s))."; return 0; fi

  # Cada backup tem 2 arquivos (.dump.enc e .meta.json): conta só os .dump.enc antigos.
  local old_dumps=0 key
  for key in $old; do [[ "$key" == *.dump.enc ]] && old_dumps=$((old_dumps + 1)); done
  remaining=$((total - old_dumps))
  if [ "$remaining" -lt "$MIN_KEEP" ]; then
    echo "  ${prefix}: NÃO apagado — sobrariam apenas ${remaining} cópia(s) (mínimo ${MIN_KEEP})."
    return 0
  fi

  for key in $old; do r2 s3 rm "s3://${R2_BUCKET}/${key}" --only-show-errors; done
  echo "  ${prefix}: ${old_dumps} backup(s) antigo(s) apagado(s); restam ${remaining}."
}

prune "db/" "$DAILY_DAYS"
prune "monthly/" "$MONTHLY_DAYS"
