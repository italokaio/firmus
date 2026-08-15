# Bucket S3 substituindo o MinIO do ambiente de desenvolvimento — mesma API
# S3, então StorageService não muda nada além das credenciais/endpoint.

resource "aws_s3_bucket" "storage" {
  bucket = "leilao-erp-${var.environment}-storage"
  tags   = { Name = "leilao-erp-storage" }
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "storage" {
  bucket                  = aws_s3_bucket.storage.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS para permitir upload direto do navegador via URL pré-assinada.
resource "aws_s3_bucket_cors_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  cors_rule {
    allowed_methods = ["GET", "PUT"]
    allowed_origins = [var.cors_origin]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# Usuário/IAM dedicado para a API assinar URLs — em vez de usar a role da
# task diretamente, mantém o mesmo modelo de credenciais explícitas do
# StorageService (STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY), sem precisar
# reescrever a integração para usar credenciais de instância/IRSA.
resource "aws_iam_user" "storage" {
  name = "leilao-erp-${var.environment}-storage"
}

resource "aws_iam_access_key" "storage" {
  user = aws_iam_user.storage.name
}

resource "aws_iam_user_policy" "storage" {
  name = "leilao-erp-storage-access"
  user = aws_iam_user.storage.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.storage.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.storage.arn
      }
    ]
  })
}
