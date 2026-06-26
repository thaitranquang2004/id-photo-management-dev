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
  full_name: z.string().trim().min(1),
  phone,
  email,
  notes: longText.optional()
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
  customer_id: uuid,
  card_type_id: uuid,
  quantity: z.coerce.number().int().min(4, 'Mỗi đơn tối thiểu 4 tấm'),
  pickup_date: z.coerce.date().optional(),
  notes: longText.optional(),
  delivery_method: z.enum(DELIVERY_METHODS).default('pickup')
});

const orderListQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  intake_source: z.enum(INTAKE_SOURCES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  created_by: uuid.optional()
});

const reportOrdersQuery = paginationQuery.extend({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  card_type_id: uuid.optional(),
  staff_id: uuid.optional(),
  status: z.enum(ORDER_STATUSES).optional()
});

const cancelOrderBody = z.object({ reason: longText.min(1) });
const completeOrderBody = z.object({ skip_layout_reason: z.string().trim().min(1).optional() }).default({});
const deliverOrderBody = z.object({ allow_unpaid_reason: z.string().trim().min(1).optional() }).default({});

const paymentCreateBody = z.object({
  loai: z.enum(PAYMENT_KINDS),
  so_tien: z.coerce.number().positive(),
  hinh_thuc: z.enum(PAYMENT_METHODS).default('cash'),
  ghi_chu: longText.optional()
});

const photoCreateBody = z.object({
  order_id: uuid,
  cloudinary_original_public_id: z.string().trim().min(1).optional(),
  original_filename: z.string().trim().optional(),
  width_px: z.coerce.number().int().positive().optional(),
  height_px: z.coerce.number().int().positive().optional(),
  file_size_bytes: z.coerce.number().int().positive().optional(),
  original_asset_metadata: z.record(z.string(), z.any()).default({})
});

const batchProcessBody = z.object({
  order_id: uuid,
  photo_ids: z.array(uuid).min(1),
  provider: z.enum(PROCESSING_PROVIDERS).default('google_ai'),
  processing_mode: z.enum(PROCESSING_MODES).default('safe_assist'),
  strict_quality_check: z.boolean().default(false)
});

const rejectPhotoBody = z.object({ reason: longText.min(1) });
const notesBody = z.object({ notes: longText.optional() }).default({});
const layoutConfigBody = z.object({
  order_id: uuid,
  photo_ids: z.array(uuid).min(1),
  layout_type: z.string().trim().min(1).default('grid'),
  paper_size: z.string().trim().min(1).default('A4'),
  add_text: z.boolean().default(false),
  layout_config: z.record(z.string(), z.any()).default({})
});

const layoutGenerateBody = layoutConfigBody.extend({
  cloudinary_public_id: z.string().trim().min(1).optional(),
  layout_asset_metadata: z.record(z.string(), z.any()).default({}),
  file_size_bytes: z.coerce.number().int().positive().optional()
});

const layoutIssueBody = z.object({
  issue_type: z.string().trim().min(1),
  note: longText.optional()
});

const reprintStatusBody = z.object({
  status: z.enum(REPRINT_STATUSES),
  note: longText.optional()
});

const reprintConvertBody = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  pickup_date: z.coerce.date().optional(),
  notes: longText.optional()
}).default({});

const publicLookupQuery = z.object({
  phone: phone.optional(),
  order_code: z.string().trim().optional(),
  token: z.string().trim().optional()
}).refine((value) => value.token || (value.phone && value.order_code), {
  message: 'Cần token hoặc phone + order_code'
});

const publicDownloadBody = publicLookupQuery;
const publicReprintBody = z.object({
  phone: phone.optional(),
  order_code: z.string().trim().optional(),
  token: z.string().trim().optional(),
  photo_ids: z.array(uuid).default([]),
  layout_id: uuid.optional(),
  quantity: z.coerce.number().int().positive().default(1),
  reason: longText.optional(),
  note: longText.optional()
}).refine((value) => value.token || (value.phone && value.order_code), {
  message: 'Cần token hoặc phone + order_code'
});

const onlineRequestBody = z.object({
  full_name: z.string().trim().min(1),
  phone,
  email,
  card_type_id: optionalUuid,
  request_type: z.enum(REQUEST_TYPES).default('both'),
  note: longText.optional(),
  preferred_date: optionalDate,
  time_slot: z.string().trim().optional()
});

const onlineRequestListQuery = paginationQuery.extend({
  status: z.enum(ONLINE_REQUEST_STATUSES).optional()
});

const rejectRequestBody = z.object({ note: longText.optional() }).default({});

const convertRequestBody = z.object({
  card_type_id: optionalUuid,
  quantity: z.coerce.number().int().min(4, 'Mỗi đơn tối thiểu 4 tấm'),
  pickup_date: z.coerce.date().optional(),
  notes: longText.optional()
});

const appointmentCreateBody = z.object({
  customer_name: z.string().trim().optional(),
  phone: phone.optional(),
  preferred_date: z.coerce.date(),
  time_slot: z.string().trim().min(1),
  note: longText.optional()
});

const appointmentListQuery = paginationQuery.extend({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional()
});

const appointmentStatusBody = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  note: longText.optional()
});

const notificationListQuery = paginationQuery.extend({
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  event_type: z.string().trim().optional(),
  order_id: optionalUuid
});

const adminUserCreateBody = z.object({
  email: z.email(),
  password: z.string().min(8).optional(),
  full_name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  role: z.enum(['staff', 'admin']).default('staff'),
  is_active: z.boolean().default(true)
});

const adminUserUpdateBody = z.object({
  full_name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  role: z.enum(['staff', 'admin']).optional(),
  is_active: z.boolean().optional(),
  disabled_at: z.coerce.date().nullable().optional()
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
