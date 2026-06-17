create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'staff',
  is_active boolean not null default true,
  shop_name text,
  avatar_url text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> ''),
  constraint profiles_role_check check (role in ('staff', 'admin'))
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_full_name_not_blank check (btrim(full_name) <> ''),
  constraint customers_phone_not_blank check (btrim(phone) <> '')
);

create table public.card_types (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  short_code text not null unique,
  width_mm numeric(5,2) not null,
  height_mm numeric(5,2) not null,
  background_color text not null default '#FFFFFF',
  requirements jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_types_name_not_blank check (btrim(name) <> ''),
  constraint card_types_short_code_not_blank check (btrim(short_code) <> ''),
  constraint card_types_size_positive check (width_mm > 0 and height_mm > 0),
  constraint card_types_requirements_object check (jsonb_typeof(requirements) = 'object')
);

create table public.pricing (
  id uuid primary key default extensions.gen_random_uuid(),
  card_type_id uuid not null references public.card_types(id) on delete restrict,
  price_per_copy numeric(10,2) not null,
  processing_fee numeric(10,2) not null default 0,
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint pricing_price_per_copy_non_negative check (price_per_copy >= 0),
  constraint pricing_processing_fee_non_negative check (processing_fee >= 0),
  constraint pricing_effective_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint pricing_no_overlap_per_card_type exclude using gist (
    card_type_id with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  )
);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_code text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  card_type_id uuid not null references public.card_types(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  status text not null default 'pending',
  total_amount numeric(12,2) not null default 0,
  quantity integer not null default 1,
  pickup_date timestamptz,
  notes text,
  cancelled_reason text,
  completed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_order_code_not_blank check (btrim(order_code) <> ''),
  constraint orders_status_check check (
    status in ('pending', 'processing', 'completed', 'delivered', 'cancelled')
  ),
  constraint orders_total_amount_non_negative check (total_amount >= 0),
  constraint orders_quantity_positive check (quantity > 0)
);

create table public.pricing_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  pricing_id uuid references public.pricing(id) on delete set null,
  card_type_id uuid not null references public.card_types(id) on delete restrict,
  card_type_name text not null,
  width_mm numeric(5,2) not null,
  height_mm numeric(5,2) not null,
  background_color text not null,
  price_per_copy numeric(10,2) not null,
  processing_fee numeric(10,2) not null default 0,
  quantity integer not null,
  total_amount numeric(12,2) not null,
  snapshot_at timestamptz not null default now(),
  constraint pricing_snapshots_card_type_name_not_blank check (btrim(card_type_name) <> ''),
  constraint pricing_snapshots_size_positive check (width_mm > 0 and height_mm > 0),
  constraint pricing_snapshots_price_per_copy_non_negative check (price_per_copy >= 0),
  constraint pricing_snapshots_processing_fee_non_negative check (processing_fee >= 0),
  constraint pricing_snapshots_quantity_positive check (quantity > 0),
  constraint pricing_snapshots_total_amount_non_negative check (total_amount >= 0)
);

create table public.processing_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  provider text not null default 'google_ai',
  status text not null default 'queued',
  strict_quality_check boolean not null default false,
  photo_count integer not null default 0,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint processing_jobs_provider_check check (provider in ('cloudinary', 'google_ai', 'hybrid')),
  constraint processing_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  constraint processing_jobs_counts_non_negative check (
    photo_count >= 0 and processed_count >= 0 and failed_count >= 0
  ),
  constraint processing_jobs_counts_not_over_total check (
    processed_count + failed_count <= photo_count
  )
);

create table public.photos (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  last_processing_job_id uuid references public.processing_jobs(id) on delete set null,
  cloudinary_original_public_id text not null,
  cloudinary_processed_public_id text,
  original_asset_metadata jsonb not null default '{}'::jsonb,
  processed_asset_metadata jsonb not null default '{}'::jsonb,
  width_px integer,
  height_px integer,
  file_size_bytes integer,
  quality_score numeric(5,2),
  quality_issues jsonb not null default '[]'::jsonb,
  manual_override boolean not null default false,
  override_notes text,
  processing_error text,
  processing_attempts integer not null default 0,
  status text not null default 'raw',
  processed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photos_original_public_id_not_blank check (btrim(cloudinary_original_public_id) <> ''),
  constraint photos_original_public_id_not_url check (
    cloudinary_original_public_id !~* '^[a-z][a-z0-9+.-]*://'
    and cloudinary_original_public_id not like '%?%'
  ),
  constraint photos_processed_public_id_not_url check (
    cloudinary_processed_public_id is null
    or (
      cloudinary_processed_public_id !~* '^[a-z][a-z0-9+.-]*://'
      and cloudinary_processed_public_id not like '%?%'
    )
  ),
  constraint photos_original_asset_metadata_object check (jsonb_typeof(original_asset_metadata) = 'object'),
  constraint photos_processed_asset_metadata_object check (jsonb_typeof(processed_asset_metadata) = 'object'),
  constraint photos_dimensions_positive check (
    (width_px is null or width_px > 0)
    and (height_px is null or height_px > 0)
  ),
  constraint photos_file_size_positive check (file_size_bytes is null or file_size_bytes > 0),
  constraint photos_quality_score_range check (
    quality_score is null or (quality_score >= 0 and quality_score <= 100)
  ),
  constraint photos_quality_issues_array check (jsonb_typeof(quality_issues) = 'array'),
  constraint photos_processing_attempts_non_negative check (processing_attempts >= 0),
  constraint photos_status_check check (
    status in ('raw', 'processing', 'processed', 'approved', 'rejected')
  )
);

create unique index photos_cloudinary_original_public_id_unique
  on public.photos (cloudinary_original_public_id);

create unique index photos_cloudinary_processed_public_id_unique
  on public.photos (cloudinary_processed_public_id)
  where cloudinary_processed_public_id is not null;

create table public.print_layouts (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  layout_type text not null,
  paper_size text not null,
  dpi integer not null default 300,
  add_text boolean not null default false,
  status text not null default 'generated',
  cloudinary_public_id text not null,
  layout_config jsonb not null default '{}'::jsonb,
  layout_asset_metadata jsonb not null default '{}'::jsonb,
  file_size_bytes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint print_layouts_layout_type_not_blank check (btrim(layout_type) <> ''),
  constraint print_layouts_paper_size_not_blank check (btrim(paper_size) <> ''),
  constraint print_layouts_dpi_positive check (dpi > 0),
  constraint print_layouts_status_check check (status in ('generated', 'needs_fix', 'archived')),
  constraint print_layouts_public_id_not_blank check (btrim(cloudinary_public_id) <> ''),
  constraint print_layouts_public_id_not_url check (
    cloudinary_public_id !~* '^[a-z][a-z0-9+.-]*://'
    and cloudinary_public_id not like '%?%'
  ),
  constraint print_layouts_layout_config_object check (jsonb_typeof(layout_config) = 'object'),
  constraint print_layouts_layout_asset_metadata_object check (jsonb_typeof(layout_asset_metadata) = 'object'),
  constraint print_layouts_file_size_positive check (file_size_bytes is null or file_size_bytes > 0),
  constraint print_layouts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index print_layouts_cloudinary_public_id_unique
  on public.print_layouts (cloudinary_public_id);

create table public.print_layout_items (
  id uuid primary key default extensions.gen_random_uuid(),
  layout_id uuid not null references public.print_layouts(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete restrict,
  position integer not null,
  crop_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint print_layout_items_position_non_negative check (position >= 0),
  constraint print_layout_items_crop_data_object check (jsonb_typeof(crop_data) = 'object'),
  constraint print_layout_items_layout_photo_position_unique unique (layout_id, photo_id, position)
);

create table public.layout_issues (
  id uuid primary key default extensions.gen_random_uuid(),
  layout_id uuid not null references public.print_layouts(id) on delete cascade,
  issue_type text not null,
  note text,
  reported_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint layout_issues_issue_type_not_blank check (btrim(issue_type) <> '')
);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_logs_old_data_object check (old_data is null or jsonb_typeof(old_data) = 'object'),
  constraint audit_logs_new_data_object check (new_data is null or jsonb_typeof(new_data) = 'object')
);

create table public.customer_access_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint customer_access_tokens_token_hash_not_blank check (btrim(token_hash) <> ''),
  constraint customer_access_tokens_expires_after_created check (expires_at > created_at)
);

create table public.public_lookup_events (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  photo_id uuid references public.photos(id) on delete set null,
  action text not null default 'lookup',
  result text not null default 'success',
  phone text,
  order_code text,
  success boolean not null default false,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint public_lookup_events_action_check check (
    action in ('lookup', 'download', 'reprint_requested')
  ),
  constraint public_lookup_events_result_check check (
    result in ('success', 'not_found', 'rate_limited', 'invalid', 'failed')
  ),
  constraint public_lookup_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.public_reprint_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_photo_ids uuid[] not null default array[]::uuid[],
  requested_layout_id uuid references public.print_layouts(id) on delete set null,
  quantity integer not null default 1,
  phone text,
  order_code text,
  reason text,
  note text,
  status text not null default 'new',
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  constraint public_reprint_requests_quantity_positive check (quantity > 0),
  constraint public_reprint_requests_status_check check (
    status in ('new', 'reviewed', 'accepted', 'rejected', 'completed')
  )
);

create table public.export_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  report_type text not null default 'orders',
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  cloudinary_public_id text,
  signed_url_expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint export_jobs_report_type_check check (report_type in ('orders', 'photos', 'layouts')),
  constraint export_jobs_filters_object check (jsonb_typeof(filters) = 'object'),
  constraint export_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  constraint export_jobs_public_id_not_url check (
    cloudinary_public_id is null
    or (
      cloudinary_public_id !~* '^[a-z][a-z0-9+.-]*://'
      and cloudinary_public_id not like '%?%'
    )
  )
);

create index idx_profiles_role on public.profiles (role);
create index idx_customers_phone on public.customers (phone);
create index idx_customers_active_phone on public.customers (is_active, phone);
create index idx_customers_created_by on public.customers (created_by);
create index idx_pricing_active on public.pricing (card_type_id, effective_from desc, effective_to);
create index idx_orders_code on public.orders (order_code);
create index idx_orders_status on public.orders (status);
create index idx_orders_customer on public.orders (customer_id);
create index idx_orders_card_type on public.orders (card_type_id);
create index idx_orders_created_by on public.orders (created_by);
create index idx_orders_created_at on public.orders (created_at desc);
create index idx_pricing_snapshots_order on public.pricing_snapshots (order_id);
create index idx_processing_jobs_order on public.processing_jobs (order_id);
create index idx_processing_jobs_status on public.processing_jobs (status);
create index idx_photos_order on public.photos (order_id);
create index idx_photos_status on public.photos (status);
create index idx_photos_processing_job on public.photos (last_processing_job_id);
create index idx_print_layouts_order on public.print_layouts (order_id);
create index idx_print_layouts_created_by on public.print_layouts (created_by);
create index idx_print_layouts_status on public.print_layouts (status);
create index idx_layout_issues_layout on public.layout_issues (layout_id, created_at desc);
create index idx_layout_issues_type on public.layout_issues (issue_type);
create index idx_audit_logs_actor on public.audit_logs (actor_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index idx_customer_access_tokens_order on public.customer_access_tokens (order_id);
create index idx_public_lookup_events_created_at on public.public_lookup_events (created_at desc);
create index idx_public_lookup_events_action_result
  on public.public_lookup_events (action, result, created_at desc);
create index idx_public_lookup_events_ip_time
  on public.public_lookup_events (ip_hash, created_at desc);
create index idx_public_lookup_events_phone_code_time
  on public.public_lookup_events (phone, order_code, created_at desc);
create index idx_public_reprint_requests_order on public.public_reprint_requests (order_id);
create index idx_public_reprint_requests_status
  on public.public_reprint_requests (status, created_at desc);
create index idx_export_jobs_requested_by on public.export_jobs (requested_by, created_at desc);
create index idx_export_jobs_status on public.export_jobs (status, created_at desc);

comment on column public.photos.cloudinary_original_public_id is
  'Cloudinary original asset public_id only. Do not store signed URLs or delivery URLs.';
comment on column public.photos.cloudinary_processed_public_id is
  'Cloudinary processed asset public_id only. Do not store signed URLs or delivery URLs.';
comment on column public.print_layouts.cloudinary_public_id is
  'Cloudinary layout artifact public_id only. Do not store signed URLs or delivery URLs.';
comment on column public.customer_access_tokens.token_hash is
  'Hash of the public customer token. Do not store plaintext tokens.';
comment on column public.export_jobs.cloudinary_public_id is
  'Cloudinary export artifact public_id only. Do not store signed URLs or delivery URLs.';
comment on column public.export_jobs.signed_url_expires_at is
  'Expiry metadata for a generated signed URL; the signed URL itself must not be stored.';

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.card_types enable row level security;
alter table public.pricing enable row level security;
alter table public.orders enable row level security;
alter table public.pricing_snapshots enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.photos enable row level security;
alter table public.print_layouts enable row level security;
alter table public.print_layout_items enable row level security;
alter table public.layout_issues enable row level security;
alter table public.audit_logs enable row level security;
alter table public.customer_access_tokens enable row level security;
alter table public.public_lookup_events enable row level security;
alter table public.public_reprint_requests enable row level security;
alter table public.export_jobs enable row level security;

revoke all on table
  public.profiles,
  public.customers,
  public.card_types,
  public.pricing,
  public.orders,
  public.pricing_snapshots,
  public.processing_jobs,
  public.photos,
  public.print_layouts,
  public.print_layout_items,
  public.layout_issues,
  public.audit_logs,
  public.customer_access_tokens,
  public.public_lookup_events,
  public.public_reprint_requests,
  public.export_jobs
from anon, authenticated;

grant usage on schema public to authenticated, service_role;

grant select on table public.profiles to authenticated;

create or replace function public.current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
  limit 1;
$$;

create or replace function public.is_active_staff_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_profile_role() in ('staff', 'admin');
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_profile_role() = 'admin';
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.is_active_staff_or_admin() from public;
revoke all on function public.is_active_admin() from public;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_active_staff_or_admin() to authenticated;
grant execute on function public.is_active_admin() to authenticated;

create policy "profile owner can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

grant select, insert, update, delete on table
  public.profiles,
  public.customers,
  public.card_types,
  public.pricing,
  public.orders,
  public.pricing_snapshots,
  public.processing_jobs,
  public.photos,
  public.print_layouts,
  public.print_layout_items,
  public.layout_issues,
  public.audit_logs,
  public.customer_access_tokens,
  public.public_lookup_events,
  public.public_reprint_requests,
  public.export_jobs
to service_role;
