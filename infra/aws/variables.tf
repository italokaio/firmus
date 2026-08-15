variable "aws_region" {
  description = "Região AWS onde os recursos serão provisionados"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Nome do ambiente (afeta tags, multi_az/deletion_protection do RDS etc.)"
  type        = string
  default     = "production"
}

# ---------------- Banco de dados ----------------

variable "db_instance_class" {
  description = "Classe da instância RDS"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "Nome do banco Postgres"
  type        = string
  default     = "leilao_erp"
}

variable "db_username" {
  description = "Usuário master do RDS"
  type        = string
  default     = "leilao"
}

variable "db_password" {
  description = "Senha do RDS — passe via TF_VAR_db_password ou *.tfvars fora do controle de versão"
  type        = string
  sensitive   = true
}

# ---------------- Autenticação (API) ----------------

variable "jwt_access_secret" {
  description = "Segredo usado para assinar access tokens JWT"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "Segredo usado para assinar refresh tokens JWT"
  type        = string
  sensitive   = true
}

# ---------------- Rede / CORS ----------------

variable "cors_origin" {
  description = "Origem permitida para CORS da API e do bucket S3 (ex.: https://app.seudominio.com)"
  type        = string
}

variable "cookie_domain" {
  description = "Domínio dos cookies de sessão (ex.: .seudominio.com) — deixe vazio se API e web forem o mesmo host"
  type        = string
  default     = ""
}

variable "next_public_api_url" {
  description = "URL pública da API, injetada no build/runtime do web (ex.: https://api.seudominio.com)"
  type        = string
}

# ---------------- ECS ----------------

variable "api_image_tag" {
  description = "Tag da imagem da API publicada no ECR a ser implantada"
  type        = string
  default     = "latest"
}

variable "web_image_tag" {
  description = "Tag da imagem do web publicada no ECR a ser implantada"
  type        = string
  default     = "latest"
}

variable "api_desired_count" {
  description = "Número de tasks desejadas do serviço da API"
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Número de tasks desejadas do serviço do web"
  type        = number
  default     = 1
}
