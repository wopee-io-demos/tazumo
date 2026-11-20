-- Up Migration
ALTER TABLE users ADD COLUMN erased_at timestamptz;
ALTER TABLE users ADD CONSTRAINT users_erasure_consistent CHECK ((erased_at IS NULL) = (subject NOT LIKE 'erased:%'));
CREATE INDEX users_erased_at_idx ON users (erased_at) WHERE erased_at IS NOT NULL;

CREATE FUNCTION random_tombstone() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'erased:r:' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

CREATE FUNCTION forget_erased_subjects(recognition_window interval) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  forgotten integer;
BEGIN
  UPDATE users SET subject = random_tombstone()
   WHERE users.erased_at < now() - recognition_window AND users.subject ~ '^erased:[0-9a-f]{64}$';
  GET DIAGNOSTICS forgotten = ROW_COUNT;
  RETURN forgotten;
END;
$$;

CREATE FUNCTION erase_user(target uuid, pseudonym text, actor uuid, initiator text, request_id text, recognition_window interval)
RETURNS TABLE (result_outcome text, result_erased_at timestamptz, result_blockers text[])
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  found_user users%ROWTYPE;
  found_blockers text[] := '{}';
  erased timestamptz;
BEGIN
  IF pseudonym !~ '^erased:[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid pseudonym'; END IF;
  IF initiator NOT IN ('self', 'admin', 'support') THEN RAISE EXCEPTION 'invalid initiator'; END IF;

  SELECT * INTO found_user FROM users WHERE users.id = target FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::timestamptz, NULL::text[];
    RETURN;
  END IF;
  IF found_user.erased_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_erased'::text, found_user.erased_at, NULL::text[];
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = target AND r.role = 'admin') THEN
    found_blockers := found_blockers || 'admin_grant'::text;
  END IF;
  IF initiator = 'support'
     AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = target AND r.role IN ('support', 'merchant_staff', 'courier')) THEN
    found_blockers := found_blockers || 'staff_grant'::text;
  END IF;
  IF cardinality(found_blockers) > 0 THEN
    RETURN QUERY SELECT 'blocked'::text, NULL::timestamptz, found_blockers;
    RETURN;
  END IF;

  UPDATE users SET subject = random_tombstone()
   WHERE users.issuer = found_user.issuer AND users.subject = pseudonym AND users.id <> target;
  UPDATE users SET subject = pseudonym, erased_at = now() WHERE users.id = target RETURNING users.erased_at INTO erased;
  DELETE FROM user_roles r WHERE r.user_id = target;
  INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, request_id, details)
  VALUES (actor, 'user:erase', 'user', target::text, request_id, jsonb_build_object('initiator', initiator));
  PERFORM forget_erased_subjects(recognition_window);
  RETURN QUERY SELECT 'erased'::text, erased, NULL::text[];
END;
$$;

CREATE FUNCTION user_roles_reject_erased() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  erased timestamptz;
BEGIN
  SELECT u.erased_at INTO erased FROM users u WHERE u.id = NEW.user_id FOR SHARE;
  IF erased IS NOT NULL THEN
    RAISE EXCEPTION 'user_erased' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_roles_reject_erased BEFORE INSERT ON user_roles
  FOR EACH ROW EXECUTE FUNCTION user_roles_reject_erased();

CREATE FUNCTION export_audit_events(target uuid)
RETURNS TABLE (occurred_at timestamptz, action text, resource_type text, resource_id text, initiated_by text, details jsonb)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT a.occurred_at, a.action, a.resource_type, a.resource_id,
         CASE WHEN a.actor_user_id = target THEN 'self' ELSE 'staff' END,
         jsonb_strip_nulls(jsonb_build_object(
           'role', a.details->'role', 'merchantId', a.details->'merchantId', 'initiator', a.details->'initiator'))
    FROM audit_events a
   WHERE a.actor_user_id = target OR (a.resource_type = 'user' AND a.resource_id = target::text)
   ORDER BY a.occurred_at, a.id
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['random_tombstone()', 'forget_erased_subjects(interval)',
    'erase_user(uuid, text, uuid, text, text, interval)', 'user_roles_reject_erased()', 'export_audit_events(uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %I, pg_temp', fn, current_schema());
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION erase_user(uuid, text, uuid, text, text, interval) TO tazumo_api;
GRANT EXECUTE ON FUNCTION export_audit_events(uuid) TO tazumo_api;
GRANT EXECUTE ON FUNCTION forget_erased_subjects(interval) TO tazumo_api;

-- Down Migration
DROP TRIGGER user_roles_reject_erased ON user_roles;
DROP FUNCTION user_roles_reject_erased();
DROP FUNCTION export_audit_events(uuid);
DROP FUNCTION erase_user(uuid, text, uuid, text, text, interval);
DROP FUNCTION forget_erased_subjects(interval);
DROP FUNCTION random_tombstone();
DROP INDEX users_erased_at_idx;
ALTER TABLE users DROP CONSTRAINT users_erasure_consistent;
ALTER TABLE users DROP COLUMN erased_at;
