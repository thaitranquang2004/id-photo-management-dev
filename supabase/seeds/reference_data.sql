insert into public.card_types (
  id,
  name,
  short_code,
  width_mm,
  height_mm,
  background_color,
  requirements,
  display_order
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'Hộ chiếu Việt Nam',
    'passport_vn_40x60',
    40,
    60,
    '#FFFFFF',
    '{"pose": "nhìn thẳng", "glasses": false, "face_ratio": "70-80%", "source": "ICAO / Cổng DVC Bộ Công an"}'::jsonb,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'CCCD / Căn cước nộp DVC',
    'cccd_dvc_30x40',
    30,
    40,
    '#FFFFFF',
    '{"pose": "nhìn thẳng", "glasses": false, "face_ratio": "~75%", "note": "Ảnh in trên thẻ cứng là 20x30 mm; hồ sơ trực tuyến thường dùng 30x40 mm"}'::jsonb,
    2
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Giấy phép lái xe',
    'gplx_30x40',
    30,
    40,
    '#0066CC',
    '{"pose": "nhìn thẳng", "glasses": "không đeo kính màu", "face_ratio": "70-80%", "allowed_background_colors": ["#0066CC", "#FFFFFF"]}'::jsonb,
    3
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Khám sức khỏe GPLX',
    'gplx_health_40x60',
    40,
    60,
    '#FFFFFF',
    '{"pose": "nhìn thẳng", "eyes": "nhìn rõ mắt", "allowed_background_colors": ["#FFFFFF", "#0066CC"]}'::jsonb,
    4
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'Thẻ học sinh / sinh viên',
    'student_30x40',
    30,
    40,
    '#0066CC',
    '{"source": "quy cách phổ biến tại trường học", "allowed_background_colors": ["#0066CC", "#FFFFFF"]}'::jsonb,
    5
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'Thẻ nhân viên',
    'employee_30x40',
    30,
    40,
    '#0066CC',
    '{"source": "quy định nội bộ doanh nghiệp", "allowed_background_colors": ["#0066CC", "#FFFFFF"], "alternate_sizes_mm": [{"width": 40, "height": 60}]}'::jsonb,
    6
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'Ảnh tùy chỉnh',
    'custom',
    35,
    45,
    '#FFFFFF',
    '{"custom": true, "note": "Dùng cho visa, ảnh ngành, hoặc nhu cầu tiệm không nằm trong seed MVP"}'::jsonb,
    7
  )
on conflict (id) do update set
  name = excluded.name,
  short_code = excluded.short_code,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  background_color = excluded.background_color,
  requirements = excluded.requirements,
  display_order = excluded.display_order,
  updated_at = now();

insert into public.pricing (
  id,
  card_type_id,
  price_per_copy,
  processing_fee,
  effective_from,
  effective_to,
  created_by
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 50000, 0, date '2026-01-01', null, null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 35000, 0, date '2026-01-01', null, null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 35000, 0, date '2026-01-01', null, null),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 50000, 0, date '2026-01-01', null, null),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 30000, 0, date '2026-01-01', null, null),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 30000, 0, date '2026-01-01', null, null),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 60000, 0, date '2026-01-01', null, null)
on conflict (id) do update set
  card_type_id = excluded.card_type_id,
  price_per_copy = excluded.price_per_copy,
  processing_fee = excluded.processing_fee,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  created_by = excluded.created_by;
