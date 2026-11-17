#!/usr/bin/env bash
# Copia os arquivos enviados pelos usuários (PDFs e fotos do bucket de produção) para o bucket de backup.
# Só adiciona/atualiza — NUNCA apaga: um arquivo removido por engano na produção continua guardado aqui.
# Variáveis: R2_SOURCE_BUCKET (produção) além das do lib.sh.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"
: "${R2_SOURCE_BUCKET:?defina R2_SOURCE_BUCKET}"

echo "Copiando arquivos de ${R2_SOURCE_BUCKET} para ${R2_BUCKET}/files/ …"
r2 s3 sync "s3://${R2_SOURCE_BUCKET}" "s3://${R2_BUCKET}/files" --only-show-errors

COUNT="$(r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "files/" --query "length(Contents)" --output text 2>/dev/null || echo 0)"
[ "$COUNT" = "None" ] && COUNT=0
echo "Cópia de arquivos concluída: ${COUNT} arquivo(s) no backup."
