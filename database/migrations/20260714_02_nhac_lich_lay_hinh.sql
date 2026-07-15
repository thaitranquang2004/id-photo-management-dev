-- Ghi nhận thời điểm đã gửi nhắc lịch lấy hình để cron không gửi lặp.
alter table public.lich_hen add column if not exists ngay_nhac_lay_hinh timestamptz;
