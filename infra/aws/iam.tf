# Roles ECS: execução (puxar imagem do ECR, ler segredos, mandar logs) e
# task (permissões que o CÓDIGO da aplicação usa em runtime — hoje nenhuma
# API AWS além do S3, que já é acessado via credenciais explícitas do
# aws_iam_user.storage, então a task role fica enxuta por padrão).

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "leilao-erp-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.db_password.arn,
        aws_secretsmanager_secret.jwt_access_secret.arn,
        aws_secretsmanager_secret.jwt_refresh_secret.arn,
        aws_secretsmanager_secret.storage_access_key.arn,
        aws_secretsmanager_secret.storage_secret_key.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name               = "leilao-erp-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}
