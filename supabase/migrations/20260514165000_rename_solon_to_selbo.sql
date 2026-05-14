-- migration_name: rename_solon_to_selbo
-- description: Preserves existing M0 data while renaming Solon schema objects to Selbo.

do $$
begin
  if to_regclass('public.solon_instances') is not null
     and to_regclass('public.selbo_instances') is null then
    alter table public.solon_instances rename to selbo_instances;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'monitor_ticks'
      and column_name = 'solon_instance_id'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'monitor_ticks'
      and column_name = 'selbo_instance_id'
  ) then
    alter table public.monitor_ticks
      rename column solon_instance_id to selbo_instance_id;
  end if;
end $$;

-- Constraint and index names are not part of the application contract, but
-- renaming them keeps future schema diffs readable after the table rename.
do $$
begin
  alter index if exists public.solon_instances_pkey rename to selbo_instances_pkey;
  alter index if exists public.solon_instances_user_id_unique rename to selbo_instances_user_id_unique;
  alter index if exists public.solon_instances_circle_wallet_id_unique rename to selbo_instances_circle_wallet_id_unique;
  alter index if exists public.solon_instances_billing_customer_id_unique rename to selbo_instances_billing_customer_id_unique;
  alter index if exists public.solon_instances_billing_subscription_id_unique rename to selbo_instances_billing_subscription_id_unique;
  alter index if exists public.solon_instances_username_unique rename to selbo_instances_username_unique;
exception
  when undefined_object then
    null;
end $$;
