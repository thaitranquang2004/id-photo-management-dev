const { z } = require('zod');
const {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_PROVIDERS,
  REPRINT_STATUSES
} = require('../config/constants');

const uuid = z.uuid();
const phone = z.string().trim().min(6).max(20).regex(/^[0-9+()\-\s.]+$/);
const email = z.email().optional().or(z.literal('').transform(() => undefined));
const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
}).passthrough();
const idParam = z.object({ id: uuid });

const customerCreateBody = z.object({
  full_name: z.string().trim().min(1),
  phone,
  email,
  notes: z.string().trim().optional()
});

const customerUpdateBody = customerCreateBody.partial();

const cardTypeBody = z.object({
  name: z.string().trim().min(1),
  short_code: z.string().trim().min(1),
  width_mm: z.coerce.number().positive(),
  height_mm: z.coerce.number().positive(),
  background_color: z.string().trim().min(1).default('#FFFFFF'),
  requirements: z.record(z.string(), z.any()).default({}),
  display_order: z.coerce.number().int().default(0)
});

const cardTypePatchBody = cardTypeBody.partial();

const pricingCreateBody = z.object({
  card_type_id: uuid,
  price_per_copy: z.coerce.number().nonnegative(),
  processing_fee: z.coerce.number().nonnegative().default(0),
  effective_from: z.coerce.date(),
  effective_to: z.coerce.date().optional()
}).refine((value) => !value.effective_to || value.effective_to >= value.effective_from, {
  path: ['effective_to'],
  message: 'effective_to phải lớn hơn hoặc bằng effective_from'
});

const orderCreateBody = z.object({
  customer_id: uuid,
  card_type_id: uuid,
  quantity: z.coerce.number().int().positive(),
  pickup_date: z.coerce.date().optional(),
  notes: z.string().trim().optional()
});

const orderListQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  created_by: uuid.optional()
});

const cancelOrderBody = z.object({ reason: z.string().trim().min(1) });
const completeOrderBody = z.object({ skip_layout_reason: z.string().trim().min(1).optional() }).default({});

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
  strict_quality_check: z.boolean().default(false)
});

const rejectPhotoBody = z.object({ reason: z.string().trim().min(1) });
const notesBody = z.object({ notes: z.string().trim().optional() }).default({});
const photoOverrideBody = z.object({
  cloudinary_processed_public_id: z.string().trim().min(1),
  notes: z.string().trim().optional()
});

const layoutConfigBody = z.object({
  order_id: uuid,
  photo_ids: z.array(uuid).min(1),
  layout_type: z.string().trim().min(1),
  paper_size: z.string().trim().min(1),
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
  note: z.string().trim().optional()
});

const reprintStatusBody = z.object({
  status: z.enum(REPRINT_STATUSES),
  note: z.string().trim().optional()
});

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
  reason: z.string().trim().optional(),
  note: z.string().trim().optional()
}).refine((value) => value.token || (value.phone && value.order_code), {
  message: 'Cần token hoặc phone + order_code'
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
  cancelOrderBody,
  completeOrderBody,
  photoCreateBody,
  batchProcessBody,
  rejectPhotoBody,
  notesBody,
  photoOverrideBody,
  layoutConfigBody,
  layoutGenerateBody,
  layoutIssueBody,
  reprintStatusBody,
  publicLookupQuery,
  publicDownloadBody,
  publicReprintBody,
  adminUserCreateBody,
  adminUserUpdateBody
};
