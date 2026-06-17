const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { publicApiLimiter } = require('../middleware/rate-limit.middleware');
const { asyncHandler } = require('../utils/async-handler');
const schemas = require('../validation/schemas');
const customers = require('../controllers/customers.controller');
const catalog = require('../controllers/catalog.controller');
const orders = require('../controllers/orders.controller');
const photos = require('../controllers/photos.controller');
const layouts = require('../controllers/layouts.controller');
const reprints = require('../controllers/reprint.controller');
const admin = require('../controllers/admin.controller');
const publicController = require('../controllers/public.controller');
const { sendSuccess } = require('../utils/responses');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 10 } });

const paramsId = z.object({ params: schemas.idParam });
const emptyBody = z.object({}).default({});
const listQuery = z.object({ query: schemas.paginationQuery });
const reportQuery = z.object({
  query: schemas.paginationQuery.extend({
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional()
  })
});

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

router.use(authenticate, requireRole('staff', 'admin'));

router.get(
  '/customers',
  validate(z.object({ query: schemas.paginationQuery.extend({ phone: schemas.phone.optional() }) })),
  asyncHandler(customers.list)
);
router.get('/customers/:id', validate(paramsId), asyncHandler(customers.get));
router.post('/customers', validate(z.object({ body: schemas.customerCreateBody })), asyncHandler(customers.create));
router.patch('/customers/:id', validate(z.object({ params: schemas.idParam, body: schemas.customerUpdateBody })), asyncHandler(customers.update));
router.patch('/customers/:id/archive', validate(z.object({ params: schemas.idParam, body: z.object({ reason: z.string().optional() }).default({}) })), asyncHandler(customers.archive));
router.get('/customers/:id/print-layouts', validate(z.object({ params: schemas.idParam, query: schemas.paginationQuery })), asyncHandler(customers.printLayouts));

router.get('/card-types', asyncHandler(catalog.listCardTypes));
router.post('/card-types', requireRole('admin'), validate(z.object({ body: schemas.cardTypeBody })), asyncHandler(catalog.createCardType));
router.patch('/card-types/:id', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: schemas.cardTypePatchBody })), asyncHandler(catalog.updateCardType));
router.patch('/card-types/:id/archive', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(catalog.archiveCardType));
router.get('/pricing', requireRole('admin'), validate(z.object({ query: z.object({ card_type_id: schemas.uuid.optional() }) })), asyncHandler(catalog.listPricing));
router.post('/pricing', requireRole('admin'), validate(z.object({ body: schemas.pricingCreateBody })), asyncHandler(catalog.createPricing));

router.get('/orders', validate(z.object({ query: schemas.orderListQuery })), asyncHandler(orders.list));
router.get('/orders/:id', validate(paramsId), asyncHandler(orders.get));
router.post('/orders', validate(z.object({ body: schemas.orderCreateBody })), asyncHandler(orders.create));
router.post('/orders/:id/start-processing', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(orders.startProcessing));
router.post('/orders/:id/complete', validate(z.object({ params: schemas.idParam, body: schemas.completeOrderBody })), asyncHandler(orders.complete));
router.post('/orders/:id/deliver', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(orders.deliver));
router.post('/orders/:id/cancel', validate(z.object({ params: schemas.idParam, body: schemas.cancelOrderBody })), asyncHandler(orders.cancel));

router.post('/photos', upload.array('files'), validate(z.object({ body: schemas.photoCreateBody })), asyncHandler(photos.create));
router.post('/photos/batch-process', validate(z.object({ body: schemas.batchProcessBody })), asyncHandler(photos.batchProcess));
router.get('/processing-jobs/:id', validate(paramsId), asyncHandler(photos.getJob));
router.get('/photos/:id', validate(paramsId), asyncHandler(photos.get));
router.post('/photos/:id/approve', validate(z.object({ params: schemas.idParam, body: schemas.notesBody })), asyncHandler(photos.approve));
router.post('/photos/:id/reject', validate(z.object({ params: schemas.idParam, body: schemas.rejectPhotoBody })), asyncHandler(photos.reject));
router.post('/photos/:id/override', validate(z.object({ params: schemas.idParam, body: schemas.photoOverrideBody })), asyncHandler(photos.override));

router.post('/layouts/validate-config', validate(z.object({ body: schemas.layoutConfigBody })), asyncHandler(layouts.validateConfig));
router.post('/layouts/preview', validate(z.object({ body: schemas.layoutConfigBody })), asyncHandler(layouts.preview));
router.post('/layouts/generate', validate(z.object({ body: schemas.layoutGenerateBody })), asyncHandler(layouts.generate));
router.get('/layouts/:id', validate(paramsId), asyncHandler(layouts.get));
router.post('/layouts/:id/download-url', validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(layouts.downloadUrl));
router.post('/layouts/:id/reprint', validate(z.object({ params: schemas.idParam, body: z.object({ reason: z.string().optional() }).default({}) })), asyncHandler(layouts.reprint));
router.post('/layouts/:id/issues', validate(z.object({ params: schemas.idParam, body: schemas.layoutIssueBody })), asyncHandler(layouts.issue));

router.get('/reprint-requests', validate(listQuery), asyncHandler(reprints.list));
router.get('/reprint-requests/:id', validate(paramsId), asyncHandler(reprints.get));
router.patch('/reprint-requests/:id/status', validate(z.object({ params: schemas.idParam, body: schemas.reprintStatusBody })), asyncHandler(reprints.updateStatus));

router.get('/admin/dashboard', requireRole('admin'), asyncHandler(admin.dashboard));
router.get('/admin/reports/orders', requireRole('admin'), validate(reportQuery), asyncHandler(admin.ordersReport));
router.get('/admin/reports/orders.csv', requireRole('admin'), validate(reportQuery), asyncHandler(admin.ordersReportCsv));
router.post('/admin/reports/orders/export', requireRole('admin'), validate(z.object({
  body: z.object({
    report_type: z.enum(['orders', 'photos', 'layouts']).default('orders'),
    filters: z.record(z.string(), z.any()).default({})
  })
})), asyncHandler(admin.createExport));
router.get('/admin/export-jobs/:id', requireRole('admin'), validate(paramsId), asyncHandler(admin.getExportJob));
router.get('/admin/users', requireRole('admin'), validate(listQuery), asyncHandler(admin.listUsers));
router.post('/admin/users', requireRole('admin'), validate(z.object({ body: schemas.adminUserCreateBody })), asyncHandler(admin.createUser));
router.patch('/admin/users/:id', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: schemas.adminUserUpdateBody })), asyncHandler(admin.updateUser));
router.post('/admin/users/:id/reset-password', requireRole('admin'), validate(z.object({ params: schemas.idParam, body: emptyBody })), asyncHandler(admin.resetPassword));
router.get('/audit-logs', requireRole('admin'), validate(listQuery), asyncHandler(admin.auditLogs));

module.exports = router;
