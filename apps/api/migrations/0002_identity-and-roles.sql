-- Up Migration
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 512),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject)
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'merchant_staff', 'courier', 'support', 'admin')),
  merchant_id uuid REFERENCES merchants (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'merchant_staff') = (merchant_id IS NOT NULL)),
  UNIQUE NULLS NOT DISTINCT (user_id, role, merchant_id)
);

CREATE INDEX user_roles_merchant_id_idx ON user_roles (merchant_id) WHERE merchant_id IS NOT NULL;

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  request_id text NOT NULL
);

CREATE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();

-- Down Migration
DROP TABLE audit_events;
DROP FUNCTION audit_events_append_only();
DROP TABLE user_roles;
DROP TABLE users;
