# Backup automático do Firmus

Todo dia, às 03:17 (Brasília), o GitHub Actions copia o banco de produção (Postgres no Railway) para um
bucket **privado** do Cloudflare R2, **criptografado** e fora do Railway. Aos domingos copia também os
arquivos enviados (PDFs e fotos). Todo mês, um teste restaura o backup mais recente em um banco vazio para
provar que ele funciona. Custo: praticamente zero (o R2 tem 10 GB grátis e não cobra saída de dados).

| O quê | Quando | Onde fica | Por quanto tempo |
|---|---|---|---|
| Banco (diário) | todo dia, 03:17 | `firmus-backups/db/AAAA/MM/firmus-….dump.enc` | 30 dias |
| Banco (mensal) | dia 1º de cada mês | `firmus-backups/monthly/…` | cerca de 13 meses |
| Arquivos enviados | domingos | `firmus-backups/files/` | indefinido (nunca apaga) |
| Teste de restauração | dia 2 de cada mês | — | — |

Segurança do que está guardado: o bucket é privado, os dumps são criptografados com AES-256 antes de sair do
GitHub, e há uma trava que se recusa a apagar backups antigos se sobrariam menos de 7 cópias.

> **O repositório é público e os logs do GitHub Actions também.** Por isso os scripts nunca imprimem a
> conexão do banco, senhas, nomes ou valores — só mensagens genéricas. Mantenha assim ao alterar qualquer script.

## Configuração (uma vez só)

### 1. Cloudflare R2 — bucket e chave de acesso
1. Painel da Cloudflare → **R2 Object Storage** → **Create bucket** → nome `firmus-backups`. Deixe privado.
2. Ainda em R2, **Manage API Tokens** → **Create API Token**:
   - Permissão: **Object Read & Write**
   - Escopo: **Apply to specific buckets only** → marque `firmus-backups` **e** `firmus-prod`
   - Guarde o **Access Key ID** e o **Secret Access Key** (a Cloudflare só mostra uma vez).
3. Anote também o **Account ID** (aparece na página inicial do R2 e na URL do painel).

### 2. Senha de criptografia
Crie uma frase longa e única (por exemplo, 5 a 6 palavras aleatórias). **Guarde-a também fora do GitHub**
(gerenciador de senhas ou papel num lugar seguro). **Sem ela os backups não abrem.**

### 3. Conexão com o banco
No Railway → serviço **Postgres** → **Variables** → copie `DATABASE_PUBLIC_URL`.

### 4. Secrets no GitHub
Repositório → **Settings → Secrets and variables → Actions → New repository secret**. Crie exatamente estes cinco:

| Nome | Valor |
|---|---|
| `BACKUP_DATABASE_URL` | o `DATABASE_PUBLIC_URL` do Railway |
| `BACKUP_PASSPHRASE` | a frase de criptografia do passo 2 |
| `R2_ACCOUNT_ID` | o Account ID da Cloudflare |
| `R2_ACCESS_KEY_ID` | o Access Key ID do passo 1 |
| `R2_SECRET_ACCESS_KEY` | o Secret Access Key do passo 1 |

### 5. Primeira execução (para conferir)
Repositório → **Actions → Backup diário (banco e arquivos) → Run workflow**. Deve terminar com ✅ em poucos
minutos. Depois rode também **Teste mensal de restauração do backup → Run workflow**: ✅ significa que o
backup realmente volta.

Se algo falhar, o GitHub envia um e-mail. Abra a execução em **Actions** e leia a mensagem do passo que falhou.

## Como restaurar

Precisa do `aws` CLI (ou do painel do R2 para baixar), do `openssl` e do `pg_restore` (versão 18 ou mais nova).

```bash
# 1. Baixe o backup desejado (ou baixe pelo painel do R2)
export AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_DEFAULT_REGION=auto
ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
aws s3 ls s3://firmus-backups/db/ --recursive --endpoint-url $ENDPOINT      # lista os backups
aws s3 cp s3://firmus-backups/db/2026/11/firmus-20261117-061700.dump.enc . --endpoint-url $ENDPOINT

# 2. Descriptografe (peça a senha no prompt, sem deixá-la no histórico)
read -rs BACKUP_PASSPHRASE && export BACKUP_PASSPHRASE
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in firmus-20261117-061700.dump.enc -out firmus.dump -pass env:BACKUP_PASSPHRASE

# 3. Restaure em um banco NOVO e vazio (Postgres 18) — nunca por cima da produção sem conferir antes
pg_restore --clean --if-exists --no-owner --no-acl --dbname="postgresql://USUARIO:SENHA@HOST:5432/BANCO" firmus.dump
```

Para voltar a produção ao ar a partir de um backup: crie um novo serviço Postgres no Railway, restaure nele,
aponte a variável `DATABASE_URL` do serviço `firmus` (API) para o novo banco e reimplante. Os **arquivos**
(PDFs e fotos) vêm de `firmus-backups/files/`: copie de volta para o bucket `firmus-prod` com
`aws s3 sync s3://firmus-backups/files s3://firmus-prod --endpoint-url $ENDPOINT`.

## Rodando manualmente

- Backup agora: **Actions → Backup diário → Run workflow** (marque "Copiar também os arquivos" se quiser).
- Mudar a retenção: variáveis `DAILY_RETENTION_DAYS` e `MONTHLY_RETENTION_DAYS` em `prune.sh` (padrão 30 e 400).
- Mudar o horário: linha `cron` em `.github/workflows/backup.yml` (o horário é UTC; Brasília = UTC−3).

## Detalhes técnicos

- `pg_dump` em formato customizado, compressão máxima, validado com `pg_restore --list` (precisa ter ao menos 25
  tabelas e 20 KB) antes de enviar; depois confere que o tamanho no R2 é igual ao local.
- Em repositório público o GitHub desliga agendamentos após 60 dias sem atividade; por isso cada execução
  reativa o próprio fluxo (`gh workflow enable`), o que zera essa contagem.
- A cópia de arquivos usa `sync` **sem** `--delete`: arquivo apagado por engano na produção continua guardado.
- O cliente PostgreSQL instalado no runner é o 18, igual ao servidor do Railway. Se o Railway migrar o banco para
  uma versão maior, atualize `postgresql-client-18` em `.github/actions/setup-postgres-client/action.yml`.
