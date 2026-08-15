# Secrets Manager — credenciais sensíveis nunca em texto plano na task
# definition. As tasks ECS leem estes secrets em runtime via `secrets` no
# container_definitions (ver ecs.tf) e a role de execução tem permissão de
# leitura restrita a estes ARNs (ver iam.tf).

resource "aws_secretsmanager_secret" "db_password" {
  name = "leilao-erp-${var.environment}-db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_access_secret" {
  name = "leilao-erp-${var.environment}-jwt-access-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_access_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_access_secret.id
  secret_string = var.jwt_access_secret
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name = "leilao-erp-${var.environment}-jwt-refresh-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = var.jwt_refresh_secret
}

# Credenciais do usuário IAM dedicado ao storage (ver s3.tf) — publicadas
# como secret para a API assinar URLs pré-assinadas do S3 sem usar a role da
# task diretamente.

resource "aws_secretsmanager_secret" "storage_access_key" {
  name = "leilao-erp-${var.environment}-storage-access-key"
}

resource "aws_secretsmanager_secret_version" "storage_access_key" {
  secret_id     = aws_secretsmanager_secret.storage_access_key.id
  secret_string = aws_iam_access_key.storage.id
}

resource "aws_secretsmanager_secret" "storage_secret_key" {
  name = "leilao-erp-${var.environment}-storage-secret-key"
}

resource "aws_secretsmanager_secret_version" "storage_secret_key" {
  secret_id     = aws_secretsmanager_secret.storage_secret_key.id
  secret_string = aws_iam_access_key.storage.secret
}
