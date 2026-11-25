-- Initial provisioning ONLY, after migrations and before any merchant data.
-- Connect as the separate migration owner and pass -v app_role=dedicated_runtime_role.
-- No password or production connection belongs in this file.
\set ON_ERROR_STOP on
\if :{?app_role}
\else
  \echo 'Pass a dedicated existing application role with -v app_role=...'
  DO $$ BEGIN RAISE EXCEPTION 'Missing application role'; END $$;
\endif
BEGIN;
SELECT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname=:'app_role'
 AND r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
 AND NOT r.rolreplication AND NOT r.rolbypassrls AND r.rolname<>current_user
 AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
 AND NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=r.oid)
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=r.oid)) AS role_safe
\gset
\if :role_safe
\else
  \echo 'Role must exist, be separate and unprivileged, with no owned schema objects.'
  DO $$ BEGIN RAISE EXCEPTION 'Unsafe application role'; END $$;
\endif
DO $$ DECLARE t record; populated boolean; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','store_installation') LOOP
   EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)',t.tablename) INTO populated;
   IF populated THEN RAISE EXCEPTION 'Initial runtime grants require a new empty installation'; END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"app_role";
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."access_events" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."addresses" TO :"app_role";
GRANT INSERT, SELECT, UPDATE ON TABLE public."admin_mfa" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."admin_notifications" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."categories" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."deskcomm_connection" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."deskcomm_integrations" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."deskcomm_outbox" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."deskcomm_status_receipts" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."gmail_config" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."olivraison_integration" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."olivraison_shipments" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."order_events" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."order_items" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."orders" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."password_resets" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_adjustment_items" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_adjustments" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_cash_closings" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_cash_registers" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_cash_sessions" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_sale_items" TO :"app_role";
GRANT INSERT, SELECT ON TABLE public."pos_sales" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."product_variants" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."products" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."refresh_tokens" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."site_content" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."store_analytics" TO :"app_role";
GRANT INSERT, SELECT, UPDATE ON TABLE public."store_branding" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."store_installation" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."store_settings" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."telegram_customers" TO :"app_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public."users" TO :"app_role";
GRANT UPDATE ("activeSessionId") ON TABLE public.pos_cash_registers TO :"app_role";
-- Future migrations must grant their new tables explicitly. Immutable POS records stay append-only.
COMMIT;
