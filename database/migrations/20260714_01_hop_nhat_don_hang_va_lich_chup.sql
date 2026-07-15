-- Hợp nhất đơn hàng tại tiệm và gửi ảnh từ xa; tách lịch chụp khỏi đơn hàng.
begin;
alter table public.don_hang alter column nguoi_tao drop not null;
alter table public.don_hang drop constraint if exists orders_intake_source_check, drop constraint if exists orders_delivery_method_check;
update public.don_hang set nguon_don = case nguon_don when 'walk_in' then 'tai_tiem' when 'online' then 'gui_anh_tu_xa' when 'reprint' then 'in_lai' else nguon_don end;
update public.don_hang set hinh_thuc_giao = case hinh_thuc_giao when 'online' then 'lay_file_truc_tuyen' when 'pickup' then case when ngay_hen_lay is null then 'lay_hinh_ngay' else 'hen_lay_hinh' end else hinh_thuc_giao end;
alter table public.don_hang alter column nguon_don set default 'tai_tiem', alter column hinh_thuc_giao set default 'lay_hinh_ngay', add constraint don_hang_nguon_don_hop_le check (nguon_don in ('tai_tiem','gui_anh_tu_xa','in_lai')), add constraint don_hang_hinh_thuc_giao_hop_le check (hinh_thuc_giao in ('lay_file_truc_tuyen','lay_hinh_ngay','hen_lay_hinh'));
alter table public.lich_hen add column if not exists loai_lich text, add column if not exists email text;
alter table public.lich_hen drop constraint if exists appointments_status_check;
update public.lich_hen set loai_lich = coalesce(loai_lich, 'hen_lay_hinh');
update public.lich_hen set trang_thai = case trang_thai when 'requested' then 'cho_xac_nhan' when 'confirmed' then 'da_xac_nhan' when 'done' then 'da_xong' when 'cancelled' then 'da_huy' else trang_thai end;
alter table public.lich_hen alter column loai_lich set not null, alter column loai_lich set default 'hen_lay_hinh', alter column trang_thai set default 'cho_xac_nhan', add constraint lich_hen_loai_lich_hop_le check (loai_lich in ('dat_lich_chup','hen_lay_hinh')), add constraint lich_hen_trang_thai_hop_le check (trang_thai in ('cho_xac_nhan','da_xac_nhan','tu_choi','da_xong','da_huy')), add constraint lich_hen_email_dat_lich_chup check (loai_lich <> 'dat_lich_chup' or (email is not null and btrim(email) <> ''));
create table if not exists public.cau_hinh_khung_gio_chup (id uuid primary key default extensions.gen_random_uuid(), khung_gio text not null unique, suc_chua_toi_da integer not null check (suc_chua_toi_da > 0), dang_hoat_dong boolean not null default true, thu_tu integer not null default 0, ngay_tao timestamptz not null default now(), ngay_cap_nhat timestamptz not null default now());
alter table public.cau_hinh_khung_gio_chup enable row level security;
insert into public.cau_hinh_khung_gio_chup (khung_gio,suc_chua_toi_da,thu_tu) values ('08:00-09:00',1,1),('09:00-10:00',1,2),('10:00-11:00',1,3),('13:30-14:30',1,4),('14:30-15:30',1,5),('15:30-16:30',1,6),('16:30-17:30',1,7) on conflict (khung_gio) do nothing;
create index if not exists idx_lich_hen_loai_ngay_gio_trang_thai on public.lich_hen (loai_lich,ngay_hen,khung_gio,trang_thai);
commit;
