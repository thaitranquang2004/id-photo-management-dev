alter table public.processing_jobs
  drop constraint if exists processing_jobs_provider_check;

alter table public.processing_jobs
  alter column provider set default 'google_ai';

update public.processing_jobs
set provider = 'google_ai'
where provider = 'banana';

alter table public.processing_jobs
  add constraint processing_jobs_provider_check
  check (provider in ('cloudinary', 'google_ai', 'hybrid'));
