terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Estado remoto — descomente e aponte para um bucket S3 + tabela DynamoDB
  # (lock) já existentes antes do primeiro `terraform init` em produção.
  # backend "s3" {
  #   bucket         = "leilao-erp-terraform-state"
  #   key            = "leilao-erp/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "leilao-erp-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "leilao-erp"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
