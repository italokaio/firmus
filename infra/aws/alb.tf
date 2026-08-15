# Um único ALB público roteando por host: api.<dominio> -> API,
# app.<dominio> (ou o resto) -> web. Ajuste os `host_header` conforme o
# domínio real e aponte os registros DNS (Route53 ou outro) para
# aws_lb.main.dns_name.

resource "aws_security_group" "alb" {
  name        = "leilao-erp-alb-sg"
  description = "Tráfego HTTPS/HTTP público para o ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP (redireciona para HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "leilao-erp-alb-sg" }
}

resource "aws_lb" "main" {
  name               = "leilao-erp-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "leilao-erp-alb" }
}

resource "aws_lb_target_group" "api" {
  name        = "leilao-erp-api-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/dashboard/summary"
    matcher             = "401" # rota autenticada — 401 sem sessão confirma que a API respondeu
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "web" {
  name        = "leilao-erp-web-tg"
  port        = 3002
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/login"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# Listener HTTP só redireciona para HTTPS.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Requer um certificado ACM válido para o domínio — crie/valide fora deste
# scaffold (aws_acm_certificate + validação DNS) e passe o ARN aqui.
variable "acm_certificate_arn" {
  description = "ARN do certificado ACM (us-east-1 se usar CloudFront, região do ALB caso contrário)"
  type        = string
  default     = ""
}

resource "aws_lb_listener" "https" {
  count             = var.acm_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  count        = var.acm_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    host_header {
      values = ["api.*"]
    }
  }
}
