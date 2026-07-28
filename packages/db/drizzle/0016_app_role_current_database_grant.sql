DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guestportal_app') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO guestportal_app', current_database());
  END IF;
END
$$;
