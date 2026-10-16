-- Patch 1: fixes accounts that were created before the schema was installed (they had no profile row).
create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = public as $$
declare adm text; u record;
begin
  if auth.uid() is null then return; end if;
  select value into adm from public.app_secrets where key = 'admin_email';
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  insert into public.profiles (id, email, display_name, is_admin, access_ok)
  values (u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
          lower(u.email) = lower(adm), lower(u.email) = lower(adm))
  on conflict (id) do nothing;
end $$;
grant execute on function public.ensure_profile() to authenticated;

-- one-time backfill for everyone who already signed up
insert into public.profiles (id, email, display_name, is_admin, access_ok)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
       lower(u.email) = lower((select value from public.app_secrets where key = 'admin_email')),
       lower(u.email) = lower((select value from public.app_secrets where key = 'admin_email'))
from auth.users u on conflict (id) do nothing;
