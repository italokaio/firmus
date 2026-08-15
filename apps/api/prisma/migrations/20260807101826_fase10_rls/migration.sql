-- Fase 10 — Row Level Security (defesa em profundidade).
--
-- Habilita RLS nas tabelas com companyId (ou id, no caso de companies) direto
-- na própria linha — são as tabelas mais expostas a um eventual esquecimento
-- de `where: { companyId }` em uma query nova. As tabelas filhas alcançadas
-- só indiretamente (ex.: property_photos -> propertyId -> properties) não
-- estão cobertas aqui: exigiriam policies com EXISTS multi-hop para cada
-- cadeia de relacionamento, o que multiplica bastante a superfície sem
-- reduzir o risco real (o isolamento delas já é garantido pelo filtro de
-- companyId aplicado no nível pai em todos os services, testado em cada fase
-- deste projeto).
--
-- Importante: propositalmente SEM `FORCE ROW LEVEL SECURITY`. O papel do
-- Postgres usado pela aplicação (DATABASE_URL) é o DONO destas tabelas, e o
-- Postgres isenta donos de RLS por padrão — ou seja, estas policies NÃO
-- mudam o comportamento da aplicação hoje. Isso é deliberado: forçar RLS
-- exigiria que a app definisse `app.current_company_id` a cada conexão, o
-- que com o pool de conexões do Prisma só é seguro via PgBouncer em modo
-- session ou reescrevendo a app inteira para rodar cada requisição dentro de
-- uma única transação — mudança grande demais para entrar de forma segura
-- nesta fase sem arriscar quebrar os fluxos transacionais já testados (ex.:
-- aquisição -> jurídico, venda -> encerramento automático). As policies
-- abaixo já estão prontas e corretas para quando essa migração de conexão
-- for feita; até lá, o isolamento multiempresa em produção continua sendo
-- garantido pelo filtro de companyId em toda query, como já é hoje.

ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "companies"
  USING (id::text = current_setting('app.current_company_id', true));

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refresh_tokens"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "properties"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tags"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "finance_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "finance_accounts"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "finance_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "finance_categories"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "investors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "investors"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "brokers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brokers"
  USING ("companyId"::text = current_setting('app.current_company_id', true));

ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reports"
  USING ("companyId"::text = current_setting('app.current_company_id', true));