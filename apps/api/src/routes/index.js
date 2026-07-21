const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { publicApiLimiter, mutatingApiLimiter } = require('../middleware/rate-limit.middleware');
const { asyncHandler } = require('../utils/async-handler');
const schemas = require('../validation/schemas');
const customers = require('../controllers/customers.controller');
const catalog = require('../controllers/catalog.controller');
const orders = require('../controllers/orders.controller');
const photos = require('../controllers/photos.controller');
const reprints = require('../controllers/reprint.controller');
const admin = require('../controllers/admin.controller');
const publicController = require('../controllers/public.controller');
const intake = require('../controllers/intake.controller');
const notifications = require('../controllers/notification.controller');
const payments = require('../controllers/payment.controller');
const { sendSuccess } = require('../utils/responses');
const { errors } = require('../utils/app-error');

const router = express.Router();

// Both upload routes (staff photo upload + public online-request intake) only ever
// accept images. Reject anything else up front; the declared mimetype is spoofable,
// so downstream processing (Sharp/Cloudinary) still re-validates the actual bytes.
const ALLOWED_UPLOAD_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(errors.validation('Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP', { field: 'files' }));
  }
});

const paramsId = z.object({ params: schemas.idParam });
const emptyBody = z.object({}).default({});
const listQuery = z.object({ query: schemas.paginationQuery });
const reportQuery = z.object({ query: schemas.reportOrdersQuery });

router.get('/health', (req, res) => sendSuccess(res, {
  status: 'ok',
  service: 'id-photo-management-api',
  timestamp: new Date().toISOString()
}));

router.get(
  '/public/customer-lookup',
  publicApiLimiter,
  validate(z.object({ query: schemas.publicLookupQuery })),
  asyncHandler(publicController.customerLookup)
);

router.post(
  '/public/photos/:id/download-url',
  publicApiLimiter,
  validate(z.object({ params: schemas.idParam, body: schemas.publicDownloadBody })),
  asyncHandler(publicController.photoDownloadUrl)
);

router.post(
  '/public/reprint-requests',
  publicApiLimiter,
  validate(z.object({ body: schemas.publicReprintBody })),
  asyncHandler(publicController.createReprintRequest)
);

router.get(
  '/public/card-types',
  asyncHandler(publicController.cardTypes)
);

router.post(
  '/public/photos/qc-check',
  publicApiLimiter,
  upload.single('file'),
  validate(z.object({ body: schemas.publicQcBody })),
  asyncHandler(publicController.qcCheck)
);

router.post(
  '/public/dat-lich-chup',
  publicApiLimiter,
  validate(z.object({ body: schemas.studioBookingBody })),
  asyncHandler(intake.datLichChup)
);
router.get(
  '/public/khung-gio-chup',
  validate(z.object({ query: z.object({ ngay_hen: z.coerce.date() }) })),
  asyncHandler(intake.khungGioChup)
);
router.post(
  '/public/don-gui-anh',
  publicApiLimiter,
  upload.array('files'),
  validate(z.object({ body: schemas.remoteOnlineRequestBody })),
  asyncHandler(intake.submit)
);
router.post(
  '/public/online-requests',
  publicApiLimiter,
  upload.array('files'),
  validate(z.object({ body: schemas.remoteOnlineRequestBody })),
  asyncHandler(intake.submit)
);

router.post(
  '/public/online-requests/status',
  publicApiLimiter,
  validate(z.object({ body: schemas.publicOnlineStatusBody })),
  asyncHandler(intake.publicStatus)
);

router.use(authenticate, requireRole('staff', 'admin'), mutatingApiLimiter);

router.get('/me', (req, res) => sendSuccess(res, {
  user: {
    id: req.user.id,
    role: req.user.role,
    profile: req.user.profile
  }
}));

router.get(
  '/customers',
  validate(z.object({ query: schemas.paginationQuery.extend({ so_dien_thoai: schemas.phone.optional() }) })),
  asyncHandler(customers.list)
);
router.get('/customers/:id', validate(paramsId), asyncHandler(customers.get));
router.post('/customers', validate(z.object({ body: schemas.customerCreateBody })), asyncHandler(customers.create));
router.patch('/customers/:id', validate(z.object({ params: schemas.idParam, body: schemas.customerUpdateBody })), asyncHandler(customers.update));
router.patch('/customers/:id/archive', validate(z.object({ params: schemas.idParam, body: z.object({ ly_do: z.string().optional() }).default({}) })), asyncHandler(customers.archive));
router.get('/customers/:id/photos', validate(paramsId), asyncHandler(customers.photos));

router.get('/card-types', asyncHandler(catalog.listCardTypes));
router.post('/card-types', requireRole('admin'), validate(z.object({ body: schemas.cardTypeBody })), asyncHandler(catalog.createCardType));
router.patch('/card-types/:id', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: schemas.cardTypePatchBody })), asyncHandler(catalog.updateCardType));
router.patch('/card-types/:id/archive', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(catalog.archiveCardType));
router.get('/pricing', requireRole('admin'), validate(z.object({ query: z.object({ loai_the_id: schemas.uuid.optional() }) })), asyncHandler(catalog.listPricing));
router.post('/pricing', requireRole('admin'), validate(z.object({ body: schemas.pricingCreateBody })), asyncHandler(catalog.createPricing));
router.get('/pricing/online-file', requireRole('admin'), asyncHandler(catalog.listOnlineFilePricing));
router.post('/pricing/online-file', requireRole('admin'), validate(z.object({ body: schemas.onlineFilePricingCreateBody })), asyncHandler(catalog.createOnlineFilePricing));

router.get('/orders', validate(z.object({ query: schemas.orderListQuery })), asyncHandler(orders.list));
router.get('/orders/:id', validate(paramsId), asyncHandler(orders.get));
router.post('/orders', validate(z.object({ body: schemas.orderCreateBody })), asyncHandler(orders.create));
router.post('/orders/:id/start-processing', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(orders.startProcessing));
router.post('/orders/:id/complete', validate(z.object({ params: schemas.idParam, body: schemas.completeOrderBody })), asyncHandler(orders.complete));
router.post('/orders/:id/deliver', validate(z.object({ params: schemas.idParam, body: schemas.deliverOrderBody })), asyncHandler(orders.deliver));
router.post('/orders/:id/cancel', validate(z.object({ params: schemas.idParam, body: schemas.cancelOrderBody })), asyncHandler(orders.cancel));
router.post('/orders/:id/notify-ready', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(orders.notifyReady));
router.get('/orders/:id/payments', validate(paramsId), asyncHandler(payments.list));
router.post('/orders/:id/payments', validate(z.object({ params: schemas.idParam, body: schemas.paymentCreateBody })), asyncHandler(payments.record));

router.post('/photos', upload.array('files'), validate(z.object({ body: schemas.photoCreateBody })), asyncHandler(photos.create));
router.post('/photos/batch-process', validate(z.object({ body: schemas.batchProcessBody })), asyncHandler(photos.batchProcess));
router.get('/processing-jobs/:id', validate(paramsId), asyncHandler(photos.getJob));
router.get('/photos/:id', validate(paramsId), asyncHandler(photos.get));
router.post('/photos/:id/download-url', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(photos.downloadUrl));
router.post('/photos/:id/approve', validate(z.object({ params: schemas.idParam, body: schemas.notesBody })), asyncHandler(photos.approve));
router.post('/photos/:id/reject', validate(z.object({ params: schemas.idParam, body: schemas.rejectPhotoBody })), asyncHandler(photos.reject));
router.post('/photos/:id/requalify', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(photos.requalify));

router.get('/reprint-requests', validate(listQuery), asyncHandler(reprints.list));
router.get('/reprint-requests/:id', validate(paramsId), asyncHandler(reprints.get));
router.patch('/reprint-requests/:id/status', validate(z.object({ params: schemas.idParam, body: schemas.reprintStatusBody })), asyncHandler(reprints.updateStatus));
router.post('/reprint-requests/:id/convert', validate(z.object({ params: schemas.idParam, body: schemas.reprintConvertBody })), asyncHandler(reprints.convert));

router.get('/online-requests', validate(z.object({ query: schemas.onlineRequestListQuery })), asyncHandler(intake.list));
router.get('/online-requests/:id', validate(paramsId), asyncHandler(intake.get));
router.post('/online-requests/:id/accept', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(intake.accept));
router.post('/online-requests/:id/reject', validate(z.object({ params: schemas.idParam, body: schemas.rejectRequestBody })), asyncHandler(intake.reject));
router.post('/online-requests/:id/convert', validate(z.object({ params: schemas.idParam, body: schemas.convertRequestBody })), asyncHandler(intake.convert));

router.get('/appointments', validate(z.object({ query: schemas.appointmentListQuery })), asyncHandler(intake.listAppointments));
router.patch('/appointments/:id/status', validate(z.object({ params: schemas.idParam, body: schemas.appointmentStatusBody })), asyncHandler(intake.updateAppointmentStatus));
router.get('/admin/khung-gio-chup', requireRole('admin'), asyncHandler(intake.listCauHinhKhungGio));
router.patch('/admin/khung-gio-chup/:id', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: schemas.khungGioChupPatchBody })), asyncHandler(intake.capNhatCauHinhKhungGio));

router.get('/notifications', validate(z.object({ query: schemas.notificationListQuery })), asyncHandler(notifications.list));

router.get('/admin/dashboard', requireRole('admin'), asyncHandler(admin.dashboard));
router.get('/admin/reports/orders', requireRole('admin'), validate(reportQuery), asyncHandler(admin.ordersReport));
router.get('/admin/users', requireRole('admin'), validate(listQuery), asyncHandler(admin.listUsers));
router.post('/admin/users', requireRole('admin'), validate(z.object({ body: schemas.adminUserCreateBody })), asyncHandler(admin.createUser));
router.patch('/admin/users/:id', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: schemas.adminUserUpdateBody })), asyncHandler(admin.updateUser));
router.get('/audit-logs', requireRole('admin'), validate(listQuery), asyncHandler(admin.auditLogs));
router.post('/admin/maintenance/purge-assets', requireRole('admin'), validate(z.object({ body: emptyBody })), asyncHandler(admin.purgeAssets));

module.exports = router;
