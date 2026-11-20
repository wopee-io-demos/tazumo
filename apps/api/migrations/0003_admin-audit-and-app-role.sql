-- Up Migration
ALTER TABLE audit_events ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tazumo_api') THEN
    CREATE ROLE tazumo_api NOLOGIN;
  END IF;
END;
$$;

DO $$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO tazumo_api', current_schema());
END;
$$;

GRANT SELECT ON markets, catalogue_categories, merchants, products TO tazumo_api;
GRANT SELECT, INSERT ON users TO tazumo_api;
GRANT SELECT, INSERT, DELETE ON user_roles TO tazumo_api;
GRANT INSERT ON audit_events TO tazumo_api;

-- Down Migration
REVOKE ALL ON markets, catalogue_categories, merchants, products, users, user_roles, audit_events FROM tazumo_api;
DO $$
BEGIN
  EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM tazumo_api', current_schema());
END;
$$;
ALTER TABLE audit_events DROP COLUMN details;
