const { z } = require('zod');
const {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_PROVIDERS,
  PROCESSING_MODES,
  REPRINT_STATUSES,
  ONLINE_REQUEST_STATUSES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  NOTIFICATION_CHANNELS,
  INTAKE_SOURCES,
  DELIVERY_METHODS,
  PAYMENT_KINDS,
  PAYMENT_METHODS
} = require('../config/constants');

const uuid = z.uuid();
const optionalUuid = uuid.optional().or(z.literal('').transform(() => undefined));
const PHONE_MESSAGE = 'Số điện thoại phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx';
const EMAIL_MESSAGE = 'Email không đúng định dạng';
const normalizePhone = (value) => value.replace(/[()\-\s.]/g, '');
// Chỉ nhận số Việt Nam: 0 + 9/10 chữ số hoặc +84 + 9/10 chữ số.
// Cho phép người dùng nhập dấu cách/dấu gạch nhưng luôn lưu ở dạng đã chuẩn hóa.
const phone = z.string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^(?:0\d{9,10}|\+84\d{9,10})$/, PHONE_MESSAGE));
const optionalPhone = z.union([z.literal(''), phone]).optional().transform((value) => value || undefined);
// Bounded free-text so notes/reasons can't be used to push oversized payloads into the DB.
const longText = z.string().trim().max(2000);
const requiredEmail = z.email(EMAIL_MESSAGE);
const email = requiredEmail.optional().or(z.literal('').transform(() => undefined));
const optionalDate = z.coerce.date().optional().or(z.literal('').transform(() => undefined));
// Only printed orders validate a minimum quantity. Online-file orders canonicalize
// this field to 1 later, so legacy clients may send any integer or omit it.
const optionalQuantity = z.coerce.number().int().optional();
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

const onlineFilePricingCreateBody = z.object({
  gia_tron_goi: z.coerce.number().nonnegative(),
  hieu_luc_tu: z.coerce.date(),
  hieu_luc_den: z.coerce.date().optional()
}).refine((value) => !value.hieu_luc_den || value.hieu_luc_den >= value.hieu_luc_tu, {
  path: ['hieu_luc_den'],
  message: 'hieu_luc_den phải lớn hơn hoặc bằng hieu_luc_tu'
});

function requirePrintedQuantity(value, ctx) {
  // Body chuyển yêu cầu cho phép staff chỉ sửa một vài trường; lúc đó service
  // sẽ lấy hình thức giao/số lượng đã lưu trên yêu cầu để kiểm tra tiếp.
  if (value.hinh_thuc_giao && value.hinh_thuc_giao !== 'lay_file_truc_tuyen'
    && (value.so_luong === undefined || value.so_luong < 4)) {
    ctx.addIssue({ code: 'custom', path: ['so_luong'], message: 'Mỗi đơn tối thiểu 4 tấm' });
  }
}

const orderCreateBody = z.object({
  khach_hang_id: uuid,
  loai_the_id: uuid,
  so_luong: optionalQuantity,
  ngay_hen_lay: optionalDate,
  khung_gio_lay: z.string().trim().optional(),
  lich_hen_id: optionalUuid,
  ghi_chu: longText.optional(),
  hinh_thuc_giao: z.enum(DELIVERY_METHODS).default('lay_hinh_ngay')
}).superRefine((value, ctx) => {
  requirePrintedQuantity(value, ctx);
  if (value.hinh_thuc_giao === 'hen_lay_hinh' && (!value.ngay_hen_lay || !value.khung_gio_lay)) {
    ctx.addIssue({ code: 'custom', path: ['ngay_hen_lay'], message: 'Hẹn lấy hình cần ngày và khung giờ lấy' });
  }
});

const orderListQuery = paginationQuery.extend({
  trang_thai: z.enum(ORDER_STATUSES).optional(),
  nguon_don: z.enum(INTAKE_SOURCES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  nguoi_tao: uuid.optional(),
  chua_thanh_toan: z.coerce.boolean().optional()
});

const reportOrdersQuery = paginationQuery.extend({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  loai_the_id: uuid.optional(),
  nguoi_tao: uuid.optional(),
  trang_thai: z.enum(ORDER_STATUSES).optional()
});

const cancelOrderBody = z.object({ ly_do: longText.min(1) });
const completeOrderBody = z.object({}).default({});
const deliverOrderBody = z.object({}).default({});

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
  so_dien_thoai: phone,
  ma_don: z.string().trim().min(1, 'Vui lòng nhập mã đơn')
});

const publicDownloadBody = publicLookupQuery;
const publicReprintBody = z.object({
  so_dien_thoai: phone,
  ma_don: z.string().trim().min(1, 'Vui lòng nhập mã đơn'),
  danh_sach_anh_id: z.array(uuid).default([]),
  so_luong: z.coerce.number().int().positive().default(1),
  ly_do: longText.optional(),
  ghi_chu: longText.optional()
});

const publicQcBody = z.object({
  loai_the_id: uuid
});

const publicOnlineStatusBody = z.object({
  so_dien_thoai: phone
});

// Yêu cầu gửi ảnh từ xa: khách chọn nhu cầu giao ảnh, nhưng đơn chỉ được tạo
// sau khi staff tiếp nhận và chuyển yêu cầu thành đơn.
const remoteOnlineRequestBody = z.object({
  ho_ten: z.string().trim().min(1),
  so_dien_thoai: phone,
  email: requiredEmail,
  loai_the_id: uuid,
  so_luong: optionalQuantity,
  hinh_thuc_giao: z.enum(['lay_file_truc_tuyen', 'hen_lay_hinh']),
  ngay_hen_lay: optionalDate,
  khung_gio_lay: z.string().trim().optional(),
  ghi_chu: longText.optional()
}).superRefine((value, ctx) => {
  requirePrintedQuantity(value, ctx);
  if (value.hinh_thuc_giao === 'hen_lay_hinh' && (!value.ngay_hen_lay || !value.khung_gio_lay)) {
    ctx.addIssue({ code: 'custom', path: ['ngay_hen_lay'], message: 'Hẹn lấy hình cần ngày và khung giờ lấy' });
  }
});

const studioBookingBody = z.object({
  ten_khach: z.string().trim().min(1),
  so_dien_thoai: phone,
  email: requiredEmail,
  ngay_hen: z.coerce.date(),
  khung_gio: z.string().trim().min(1),
  ghi_chu: longText.optional()
});

const onlineRequestListQuery = paginationQuery.extend({
  trang_thai: z.enum(ONLINE_REQUEST_STATUSES).optional()
});

const rejectRequestBody = z.object({ ghi_chu: longText.optional() }).default({});

const convertRequestBody = z.object({
  loai_the_id: optionalUuid,
  hinh_thuc_giao: z.enum(['lay_file_truc_tuyen', 'hen_lay_hinh']).optional(),
  so_luong: optionalQuantity,
  ngay_hen_lay: z.coerce.date().optional(),
  khung_gio_lay: z.string().trim().optional(),
  ghi_chu: longText.optional()
}).superRefine((value, ctx) => {
  requirePrintedQuantity(value, ctx);
  if (value.hinh_thuc_giao === 'hen_lay_hinh' && (!value.ngay_hen_lay || !value.khung_gio_lay)) {
    ctx.addIssue({ code: 'custom', path: ['ngay_hen_lay'], message: 'Hẹn lấy hình cần ngày và khung giờ lấy' });
  }
});

const appointmentListQuery = paginationQuery.extend({
  trang_thai: z.enum(APPOINTMENT_STATUSES).optional(),
  loai_lich: z.enum(APPOINTMENT_TYPES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional()
});

const appointmentStatusBody = z.object({
  trang_thai: z.enum(APPOINTMENT_STATUSES),
  ghi_chu: longText.optional()
});

const khungGioChupPatchBody = z.object({
  suc_chua_toi_da: z.coerce.number().int().positive().optional(),
  dang_hoat_dong: z.boolean().optional(),
  thu_tu: z.coerce.number().int().optional()
}).refine((value) => Object.keys(value).length > 0, { message: 'Cần có dữ liệu cập nhật' });

const notificationListQuery = paginationQuery.extend({
  kenh: z.enum(NOTIFICATION_CHANNELS).optional(),
  loai_su_kien: z.string().trim().optional(),
  don_hang_id: optionalUuid
});

const adminUserCreateBody = z.object({
  email: requiredEmail,
  password: z.string().min(8).optional(),
  ho_ten: z.string().trim().min(1),
  so_dien_thoai: optionalPhone,
  vai_tro: z.enum(['staff', 'admin']).default('staff'),
  dang_hoat_dong: z.boolean().default(true)
});

const adminUserUpdateBody = z.object({
  ho_ten: z.string().trim().min(1).optional(),
  so_dien_thoai: optionalPhone,
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
  onlineFilePricingCreateBody,
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
  reprintStatusBody,
  reprintConvertBody,
  publicLookupQuery,
  publicDownloadBody,
  publicReprintBody,
  publicQcBody,
  publicOnlineStatusBody,
  studioBookingBody,
  remoteOnlineRequestBody,
  onlineRequestListQuery,
  rejectRequestBody,
  convertRequestBody,
  appointmentListQuery,
  appointmentStatusBody,
  khungGioChupPatchBody,
  notificationListQuery,
  adminUserCreateBody,
  adminUserUpdateBody
};
