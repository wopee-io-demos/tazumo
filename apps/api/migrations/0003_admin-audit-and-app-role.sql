-- Up Migration
ALTER TABLE audit_events ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  existing pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM pg_roles WHERE rolname = 'tazumo_api';
  IF NOT FOUND THEN
    CREATE ROLE tazumo_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSIF existing.rolcanlogin OR existing.rolsuper OR existing.rolbypassrls OR existing.rolcreaterole OR existing.rolcreatedb THEN
    RAISE EXCEPTION 'role tazumo_api exists with unsafe attributes (login, superuser, bypassrls, createrole or createdb)';
  END IF;
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO tazumo_api', current_schema());
END;
$$;

GRANT SELECT ON markets, catalogue_categories, merchants, products TO tazumo_api;
GRANT SELECT, INSERT ON users TO tazumo_api;
GRANT SELECT, INSERT, DELETE ON user_roles TO tazumo_api;
GRANT INSERT ON audit_events TO tazumo_api;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_runtime_read ON user_roles FOR SELECT TO tazumo_api USING (true);
CREATE POLICY user_roles_runtime_insert ON user_roles FOR INSERT TO tazumo_api WITH CHECK (role <> 'admin');
CREATE POLICY user_roles_runtime_delete ON user_roles FOR DELETE TO tazumo_api USING (role <> 'admin');

-- Down Migration
DROP POLICY user_roles_runtime_delete ON user_roles;
DROP POLICY user_roles_runtime_insert ON user_roles;
DROP POLICY user_roles_runtime_read ON user_roles;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tazumo_api') THEN
    REVOKE ALL ON markets, catalogue_categories, merchants, products, users, user_roles, audit_events FROM tazumo_api;
    EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM tazumo_api', current_schema());
  END IF;
END;
$$;
ALTER TABLE audit_events DROP COLUMN details;
