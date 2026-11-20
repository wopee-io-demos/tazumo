-- Up Migration
ALTER TABLE users ADD COLUMN erased_at timestamptz;
ALTER TABLE users ADD CONSTRAINT users_erasure_consistent CHECK ((erased_at IS NULL) = (subject NOT LIKE 'erased:%'));

GRANT UPDATE (subject, erased_at) ON users TO tazumo_api;

DROP POLICY user_roles_runtime_delete ON user_roles;
CREATE POLICY user_roles_runtime_delete ON user_roles FOR DELETE TO tazumo_api
  USING (role IN ('customer', 'courier', 'merchant_staff', 'support'));

CREATE FUNCTION export_audit_events(target uuid)
RETURNS TABLE (occurred_at timestamptz, action text, resource_type text, resource_id text, initiated_by text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT occurred_at, action, resource_type, resource_id,
         CASE WHEN actor_user_id = target THEN 'self' ELSE 'staff' END
    FROM audit_events
   WHERE actor_user_id = target OR (resource_type = 'user' AND resource_id = target::text)
   ORDER BY occurred_at, id
$$;

DO $$
BEGIN
  EXECUTE format('ALTER FUNCTION export_audit_events(uuid) SET search_path = %I, pg_temp', current_schema());
END;
$$;

REVOKE ALL ON FUNCTION export_audit_events(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_audit_events(uuid) TO tazumo_api;

-- Down Migration
DROP FUNCTION export_audit_events(uuid);
DROP POLICY user_roles_runtime_delete ON user_roles;
CREATE POLICY user_roles_runtime_delete ON user_roles FOR DELETE TO tazumo_api USING (role IN ('merchant_staff', 'support'));
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tazumo_api') THEN
    REVOKE UPDATE (subject, erased_at) ON users FROM tazumo_api;
  END IF;
END;
$$;
ALTER TABLE users DROP CONSTRAINT users_erasure_consistent;
ALTER TABLE users DROP COLUMN erased_at;
