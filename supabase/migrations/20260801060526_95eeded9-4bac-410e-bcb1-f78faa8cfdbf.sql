alter table public.profiles
  add column if not exists ring_streak integer not null default 0,
  add column if not exists last_ring_date date;

create or replace function public.bump_ring_streak()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _last date;
  _streak integer;
begin
  select last_ring_date, ring_streak into _last, _streak
  from public.profiles where id = auth.uid();
  if _last = current_date then
    return coalesce(_streak, 0);
  elsif _last = current_date - 1 then
    _streak := coalesce(_streak, 0) + 1;
  else
    _streak := 1;
  end if;
  update public.profiles
    set ring_streak = _streak, last_ring_date = current_date
    where id = auth.uid();
  return _streak;
end;
$$;

grant execute on function public.bump_ring_streak() to authenticated;