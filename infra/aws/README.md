# Infraestrutura AWS (Terraform) — Firmus - Gestão Imobiliária

> ⚠️ **Este scaffold não foi aplicado nem testado contra uma conta AWS real**
> (o ambiente onde este projeto foi desenvolvido não tinha acesso à AWS).
> Revise cuidadosamente — principalmente custos, tamanhos de instância e
> política de segurança — antes de rodar `terraform apply` em produção.

## O que provisiona

- **VPC** com 2 AZs, subnets públicas (ALB, NAT) e privadas (ECS, RDS).
- **RDS Postgres 16** em subnet privada, só acessível pela API.
- **S3** para storage de arquivos (substitui o MinIO do dev), com o mesmo
  protocolo S3 que o `StorageService` já usa — nenhuma mudança de código.
- **ECR** para as imagens Docker da API e do web.
- **ECS Fargate** rodando API e web como serviços separados, atrás de um
  **Application Load Balancer** único (roteamento por host: `api.*` vs resto).
- **Secrets Manager** para credenciais sensíveis (nunca em texto plano na
  task definition).
- **CloudWatch Logs** para os containers.

## O que falta para produção real

- Certificado ACM validado + registro DNS apontando para o ALB
  (`acm_certificate_arn`, hoje vazio por padrão — sem ele só o listener HTTP
  é criado).
- Backend remoto do Terraform (S3 + DynamoDB lock) — comentado em `main.tf`.
- Pipeline de CI que builda as imagens (`apps/api/Dockerfile`,
  `apps/web/Dockerfile`), publica no ECR e atualiza `api_image_tag`/
  `web_image_tag` (ou roda `aws ecs update-service --force-new-deployment`).
- Rodar `prisma migrate deploy` contra o RDS como parte do deploy (não é
  feito automaticamente por este Terraform).
- Rever `db_instance_class`/`api_desired_count`/`web_desired_count` para o
  tráfego real esperado — os defaults aqui são de partida (menor custo), não
  uma recomendação de capacidade.

## Uso

```bash
cd infra/aws
terraform init
terraform plan \
  -var="db_password=..." \
  -var="jwt_access_secret=..." \
  -var="jwt_refresh_secret=..." \
  -var="cors_origin=https://app.seudominio.com" \
  -var="next_public_api_url=https://api.seudominio.com"
terraform apply
```

Prefira passar os valores sensíveis via variáveis de ambiente
(`TF_VAR_db_password=...`) ou um arquivo `*.tfvars` fora do controle de
versão, nunca hardcoded ou na linha de comando em um shell compartilhado.

Depois do primeiro `apply`, publique as imagens:

```bash
aws ecr get-login-password --region <região> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<região>.amazonaws.com

docker build -f apps/api/Dockerfile -t <ecr_api_repository_url>:latest .
docker push <ecr_api_repository_url>:latest

docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.seudominio.com \
  -t <ecr_web_repository_url>:latest .
docker push <ecr_web_repository_url>:latest

aws ecs update-service --cluster <ecs_cluster_name> --service leilao-erp-api --force-new-deployment
aws ecs update-service --cluster <ecs_cluster_name> --service leilao-erp-web --force-new-deployment
```
