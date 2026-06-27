const { z } = require('zod');
const {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_PROVIDERS,
  PROCESSING_MODES,
  REPRINT_STATUSES,
  ONLINE_REQUEST_STATUSES,
  APPOINTMENT_STATUSES,
  REQUEST_TYPES,
  NOTIFICATION_CHANNELS,
  INTAKE_SOURCES,
  DELIVERY_METHODS,
  PAYMENT_KINDS,
  PAYMENT_METHODS
} = require('../config/constants');

const uuid = z.uuid();
const optionalUuid = uuid.optional().or(z.literal('').transform(() => undefined));
const phone = z.string().trim().min(6).max(20).regex(/^[0-9+()\-\s.]+$/);
// Bounded free-text so notes/reasons can't be used to push oversized payloads into the DB.
const longText = z.string().trim().max(2000);
const email = z.email().optional().or(z.literal('').transform(() => undefined));
const optionalDate = z.coerce.date().optional().or(z.literal('').transform(() => undefined));
const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
}).passthrough();
const idParam = z.object({ id: uuid });

const customerCreateBody = z.object({
  ho_ten: z.string().trim().min(1),
  so_dien_thoai: phone,
  email,
  ghi_chu: longText.optional()
});

const customerUpdateBody = customerCreateBody.partial();

const cardTypeBody = z.object({
  ten: z.string().trim().min(1),
  ma_viet_tat: z.string().trim().min(1),
  rong_mm: z.coerce.number().positive(),
  cao_mm: z.coerce.number().positive(),
  mau_nen: z.string().trim().min(1).default('#FFFFFF'),
  yeu_cau: z.record(z.string(), z.any()).default({}),
  thu_tu_hien_thi: z.coerce.number().int().default(0)
});

const cardTypePatchBody = cardTypeBody.partial();

const pricingCreateBody = z.object({
  loai_the_id: uuid,
  gia_moi_ban: z.coerce.number().nonnegative(),
  phi_xu_ly: z.coerce.number().nonnegative().default(0),
  hieu_luc_tu: z.coerce.date(),
  hieu_luc_den: z.coerce.date().optional()
}).refine((value) => !value.hieu_luc_den || value.hieu_luc_den >= value.hieu_luc_tu, {
  path: ['hieu_luc_den'],
  message: 'hieu_luc_den phải lớn hơn hoặc bằng hieu_luc_tu'
});

const orderCreateBody = z.object({
  khach_hang_id: uuid,
  loai_the_id: uuid,
  so_luong: z.coerce.number().int().min(4, 'Mỗi đơn tối thiểu 4 tấm'),
  ngay_hen_lay: z.coerce.date().optional(),
  ghi_chu: longText.optional(),
  hinh_thuc_giao: z.enum(DELIVERY_METHODS).default('pickup')
});

const orderListQuery = paginationQuery.extend({
  trang_thai: z.enum(ORDER_STATUSES).optional(),
  nguon_don: z.enum(INTAKE_SOURCES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  nguoi_tao: uuid.optional()
});

const reportOrdersQuery = paginationQuery.extend({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  loai_the_id: uuid.optional(),
  nguoi_tao: uuid.optional(),
  trang_thai: z.enum(ORDER_STATUSES).optional()
});

const cancelOrderBody = z.object({ ly_do: longText.min(1) });
const completeOrderBody = z.object({ skip_layout_reason: z.string().trim().min(1).optional() }).default({});
const deliverOrderBody = z.object({ allow_unpaid_reason: z.string().trim().min(1).optional() }).default({});

const paymentCreateBody = z.object({
  loai: z.enum(PAYMENT_KINDS),
  so_tien: z.coerce.number().positive(),
  hinh_thuc: z.enum(PAYMENT_METHODS).default('cash'),
  ghi_chu: longText.optional()
});

const photoCreateBody = z.object({
  don_hang_id: uuid,
  cloudinary_anh_goc_id: z.string().trim().min(1).optional(),
  ten_file_goc: z.string().trim().optional(),
  rong_px: z.coerce.number().int().positive().optional(),
  cao_px: z.coerce.number().int().positive().optional(),
  dung_luong_bytes: z.coerce.number().int().positive().optional(),
  metadata_anh_goc: z.record(z.string(), z.any()).default({})
});

const batchProcessBody = z.object({
  don_hang_id: uuid,
  danh_sach_anh_id: z.array(uuid).min(1),
  nha_cung_cap: z.enum(PROCESSING_PROVIDERS).default('google_ai'),
  che_do_xu_ly: z.enum(PROCESSING_MODES).default('safe_assist'),
  kiem_tra_nghiem_ngat: z.boolean().default(false)
});

const rejectPhotoBody = z.object({ ly_do: longText.min(1) });
const notesBody = z.object({ ghi_chu: longText.optional() }).default({});
const layoutConfigBody = z.object({
  don_hang_id: uuid,
  danh_sach_anh_id: z.array(uuid).min(1),
  kieu_bo_cuc: z.string().trim().min(1).default('grid'),
  kho_giay: z.string().trim().min(1).default('A4'),
  them_chu: z.boolean().default(false),
  cau_hinh_bo_cuc: z.record(z.string(), z.any()).default({})
});

const layoutGenerateBody = layoutConfigBody.extend({
  cloudinary_id: z.string().trim().min(1).optional(),
  metadata_file: z.record(z.string(), z.any()).default({}),
  dung_luong_bytes: z.coerce.number().int().positive().optional()
});

const layoutIssueBody = z.object({
  loai_loi: z.string().trim().min(1),
  ghi_chu: longText.optional()
});

const reprintStatusBody = z.object({
  trang_thai: z.enum(REPRINT_STATUSES),
  ghi_chu: longText.optional()
});

const reprintConvertBody = z.object({
  so_luong: z.coerce.number().int().positive().optional(),
  ngay_hen_lay: z.coerce.date().optional(),
  ghi_chu: longText.optional()
}).default({});

const publicLookupQuery = z.object({
  so_dien_thoai: phone.optional(),
  ma_don: z.string().trim().optional(),
  token: z.string().trim().optional()
}).refine((value) => value.token || (value.so_dien_thoai && value.ma_don), {
  message: 'Cần token hoặc so_dien_thoai + ma_don'
});

const publicDownloadBody = publicLookupQuery;
const publicReprintBody = z.object({
  so_dien_thoai: phone.optional(),
  ma_don: z.string().trim().optional(),
  token: z.string().trim().optional(),
  danh_sach_anh_id: z.array(uuid).default([]),
  bo_cuc_id: uuid.optional(),
  so_luong: z.coerce.number().int().positive().default(1),
  ly_do: longText.optional(),
  ghi_chu: longText.optional()
}).refine((value) => value.token || (value.so_dien_thoai && value.ma_don), {
  message: 'Cần token hoặc so_dien_thoai + ma_don'
});

const onlineRequestBody = z.object({
  ho_ten: z.string().trim().min(1),
  so_dien_thoai: phone,
  email,
  loai_the_id: optionalUuid,
  loai_yeu_cau: z.enum(REQUEST_TYPES).default('both'),
  ghi_chu: longText.optional(),
  ngay_hen: optionalDate,
  khung_gio: z.string().trim().optional()
});

const onlineRequestListQuery = paginationQuery.extend({
  trang_thai: z.enum(ONLINE_REQUEST_STATUSES).optional()
});

const rejectRequestBody = z.object({ ghi_chu: longText.optional() }).default({});

const convertRequestBody = z.object({
  loai_the_id: optionalUuid,
  so_luong: z.coerce.number().int().min(4, 'Mỗi đơn tối thiểu 4 tấm'),
  ngay_hen_lay: z.coerce.date().optional(),
  ghi_chu: longText.optional()
});

const appointmentCreateBody = z.object({
  ten_khach: z.string().trim().optional(),
  so_dien_thoai: phone.optional(),
  ngay_hen: z.coerce.date(),
  khung_gio: z.string().trim().min(1),
  ghi_chu: longText.optional()
});

const appointmentListQuery = paginationQuery.extend({
  trang_thai: z.enum(APPOINTMENT_STATUSES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional()
});

const appointmentStatusBody = z.object({
  trang_thai: z.enum(APPOINTMENT_STATUSES),
  ghi_chu: longText.optional()
});

const notificationListQuery = paginationQuery.extend({
  kenh: z.enum(NOTIFICATION_CHANNELS).optional(),
  loai_su_kien: z.string().trim().optional(),
  don_hang_id: optionalUuid
});

const adminUserCreateBody = z.object({
  email: z.email(),
  password: z.string().min(8).optional(),
  ho_ten: z.string().trim().min(1),
  so_dien_thoai: z.string().trim().optional(),
  vai_tro: z.enum(['staff', 'admin']).default('staff'),
  dang_hoat_dong: z.boolean().default(true)
});

const adminUserUpdateBody = z.object({
  ho_ten: z.string().trim().min(1).optional(),
  so_dien_thoai: z.string().trim().optional(),
  vai_tro: z.enum(['staff', 'admin']).optional(),
  dang_hoat_dong: z.boolean().optional(),
  ngay_luu_tru: z.coerce.date().nullable().optional()
});

module.exports = {
  uuid,
  phone,
  email,
  paginationQuery,
  idParam,
  customerCreateBody,
  customerUpdateBody,
  cardTypeBody,
  cardTypePatchBody,
  pricingCreateBody,
  orderCreateBody,
  orderListQuery,
  reportOrdersQuery,
  cancelOrderBody,
  completeOrderBody,
  deliverOrderBody,
  paymentCreateBody,
  photoCreateBody,
  batchProcessBody,
  rejectPhotoBody,
  notesBody,
  layoutConfigBody,
  layoutGenerateBody,
  layoutIssueBody,
  reprintStatusBody,
  reprintConvertBody,
  publicLookupQuery,
  publicDownloadBody,
  publicReprintBody,
  onlineRequestBody,
  onlineRequestListQuery,
  rejectRequestBody,
  convertRequestBody,
  appointmentCreateBody,
  appointmentListQuery,
  appointmentStatusBody,
  notificationListQuery,
  adminUserCreateBody,
  adminUserUpdateBody
};
