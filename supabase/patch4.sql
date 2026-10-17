-- Patch 4: lets a student delete their own account (privacy). Safe to run more than once.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'admin accounts cannot be deleted here';
  end if;
  delete from auth.users where id = auth.uid();   -- also removes the profile, progress and class access
end $$;
grant execute on function public.delete_my_account() to authenticated;
