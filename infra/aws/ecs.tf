resource "aws_ecs_cluster" "main" {
  name = "leilao-erp-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/leilao-erp-${var.environment}/api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/leilao-erp-${var.environment}/web"
  retention_in_days = 30
}

# ---------------- Security groups das tasks ----------------

resource "aws_security_group" "ecs_api" {
  name        = "leilao-erp-ecs-api-sg"
  description = "Tráfego para as tasks da API"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "ALB -> API"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "leilao-erp-ecs-api-sg" }
}

resource "aws_security_group" "ecs_web" {
  name        = "leilao-erp-ecs-web-sg"
  description = "Tráfego para as tasks do web"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "ALB -> web"
    from_port       = 3002
    to_port         = 3002
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "leilao-erp-ecs-web-sg" }
}

# ---------------- Task definitions ----------------

resource "aws_ecs_task_definition" "api" {
  family                   = "leilao-erp-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
      essential = true
      portMappings = [{ containerPort = 3001, protocol = "tcp" }]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "API_PORT", value = "3001" },
        { name = "CORS_ORIGIN", value = var.cors_origin },
        { name = "COOKIE_SECURE", value = "true" },
        { name = "COOKIE_DOMAIN", value = var.cookie_domain },
        { name = "JWT_ACCESS_EXPIRES_IN", value = "15m" },
        { name = "JWT_REFRESH_EXPIRES_IN_DAYS", value = "30" },
        { name = "STORAGE_ENDPOINT", value = "https://s3.${var.aws_region}.amazonaws.com" },
        { name = "STORAGE_REGION", value = var.aws_region },
        { name = "STORAGE_BUCKET", value = aws_s3_bucket.storage.bucket },
        { name = "STORAGE_FORCE_PATH_STYLE", value = "false" },
        { name = "DATABASE_URL", value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}?schema=public&sslmode=require" },
      ]

      secrets = [
        { name = "JWT_ACCESS_SECRET", valueFrom = aws_secretsmanager_secret.jwt_access_secret.arn },
        { name = "JWT_REFRESH_SECRET", valueFrom = aws_secretsmanager_secret.jwt_refresh_secret.arn },
        { name = "STORAGE_ACCESS_KEY", valueFrom = aws_secretsmanager_secret.storage_access_key.arn },
        { name = "STORAGE_SECRET_KEY", valueFrom = aws_secretsmanager_secret.storage_secret_key.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])

  # NOTA: DATABASE_URL acima embute a senha em variável de ambiente por
  # simplicidade do scaffold. Para produção, prefira montar a connection
  # string a partir de `secrets` (ex.: um secret JSON único com host/senha)
  # em vez de interpolar var.db_password em texto plano na task definition.
}

resource "aws_ecs_task_definition" "web" {
  family                   = "leilao-erp-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = "${aws_ecr_repository.web.repository_url}:${var.web_image_tag}"
      essential = true
      portMappings = [{ containerPort = 3002, protocol = "tcp" }]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3002" },
        { name = "NEXT_PUBLIC_API_URL", value = var.next_public_api_url },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }
    }
  ])
}

# ---------------- Services ----------------

resource "aws_ecs_service" "api" {
  name            = "leilao-erp-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_api.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name    = "api"
    container_port    = 3001
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_ecs_service" "web" {
  name            = "leilao-erp-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_web.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name    = "web"
    container_port    = 3002
  }

  depends_on = [aws_lb_listener.http]
}
