# Postgres gerenciado em subnet privada — só alcançável a partir das tasks
# ECS (ver security group), nunca exposto à internet.

resource "aws_db_subnet_group" "main" {
  name       = "leilao-erp-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "leilao-erp-db-subnets" }
}

resource "aws_security_group" "rds" {
  name        = "leilao-erp-rds-sg"
  description = "Permite Postgres só a partir das tasks ECS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres a partir da API"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_api.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "leilao-erp-rds-sg" }
}

resource "aws_db_instance" "main" {
  identifier     = "leilao-erp-${var.environment}"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  multi_az                = var.environment == "production"
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "leilao-erp-final-snapshot" : null

  tags = { Name = "leilao-erp-postgres" }
}
