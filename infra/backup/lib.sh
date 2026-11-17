#!/usr/bin/env bash
# Funções comuns dos scripts de backup. Carregado com `source`.
# ATENÇÃO: o repositório é PÚBLICO e os logs do GitHub Actions também. Nunca imprima URLs de
# conexão, senhas, nomes de clientes nem valores de linhas — só mensagens genéricas.

set -euo pipefail

: "${R2_ACCOUNT_ID:?defina R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?defina R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?defina R2_SECRET_ACCESS_KEY}"
: "${R2_BUCKET:?defina R2_BUCKET (bucket de backups)}"

# Remove quebra de linha/CR que costuma ir junto ao colar o segredo (a senha em si não os contém).
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then BACKUP_PASSPHRASE="$(printf '%s' "$BACKUP_PASSPHRASE" | tr -d '\r\n')"; export BACKUP_PASSPHRASE; fi
R2_ACCOUNT_ID="$(printf '%s' "$R2_ACCOUNT_ID" | tr -d '[:space:]')"
R2_ACCESS_KEY_ID="$(printf '%s' "$R2_ACCESS_KEY_ID" | tr -d '[:space:]')"
R2_SECRET_ACCESS_KEY="$(printf '%s' "$R2_SECRET_ACCESS_KEY" | tr -d '[:space:]')"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
# O R2 não usa os checksums novos do AWS CLI v2; evita erro de compatibilidade.
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# aws s3 ... já apontando para o R2
r2() { aws "$1" "${@:2}" --endpoint-url "$ENDPOINT"; }

# Criptografia simétrica (AES-256, senha derivada com PBKDF2). A senha vem da variável
# BACKUP_PASSPHRASE e nunca aparece na linha de comando.
encrypt_file() { openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in "$1" -out "$2" -pass env:BACKUP_PASSPHRASE; }
decrypt_file() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$1" -out "$2" -pass env:BACKUP_PASSPHRASE; }
