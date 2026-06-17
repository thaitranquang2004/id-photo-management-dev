-- Run after `supabase db reset --local`.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;

select count(*) as card_types_count
from public.card_types;

select count(*) as pricing_count
from public.pricing;

select proname, prosecdef, n.nspname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('current_profile_role', 'is_active_staff_or_admin', 'is_active_admin')
order by proname;

do $$
begin
  begin
    insert into public.orders (
      order_code,
      customer_id,
      card_type_id,
      created_by,
      quantity,
      status
    ) values (
      'ORD-VERIFY-BAD-STATUS',
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      1,
      'ready'
    );

    raise exception 'Expected orders.status = ready to fail, but it succeeded';
  exception
    when check_violation then
      raise notice 'OK: invalid orders.status was rejected';
  end;
end $$;

do $$
begin
  begin
    insert into public.orders (
      order_code,
      customer_id,
      card_type_id,
      created_by,
      quantity,
      status
    ) values (
      'ORD-VERIFY-BAD-QUANTITY',
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      0,
      'pending'
    );

    raise exception 'Expected orders.quantity = 0 to fail, but it succeeded';
  exception
    when check_violation then
      raise notice 'OK: invalid orders.quantity was rejected';
  end;
end $$;

do $$
begin
  begin
    insert into public.pricing (
      card_type_id,
      price_per_copy,
      processing_fee,
      effective_from,
      effective_to,
      created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      55000,
      0,
      date '2026-06-01',
      null,
      '00000000-0000-4000-8000-000000000001'
    );

    raise exception 'Expected overlapping pricing to fail, but it succeeded';
  exception
    when exclusion_violation then
      raise notice 'OK: overlapping pricing was rejected';
  end;
end $$;
