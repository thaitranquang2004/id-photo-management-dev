const ORDER_STATUSES = Object.freeze(['pending', 'processing', 'completed', 'delivered', 'cancelled']);
const PHOTO_STATUSES = Object.freeze(['raw', 'processing', 'processed', 'approved', 'rejected']);
const PROCESSING_JOB_STATUSES = Object.freeze(['queued', 'processing', 'completed', 'failed', 'cancelled']);
const PROCESSING_PROVIDERS = Object.freeze(['cloudinary', 'google_ai', 'hybrid']);
const PROCESSING_MODES = Object.freeze(['safe_assist', 'quality_check_only']);
const QC_STATUSES = Object.freeze(['not_checked', 'pass', 'warn', 'fail']);
const LAYOUT_STATUSES = Object.freeze(['generated', 'needs_fix', 'archived']);
const REPRINT_STATUSES = Object.freeze(['new', 'reviewed', 'accepted', 'rejected', 'completed']);
const ONLINE_REQUEST_STATUSES = Object.freeze(['new', 'accepted', 'converted', 'rejected', 'cancelled']);
const APPOINTMENT_STATUSES = Object.freeze(['requested', 'confirmed', 'done', 'cancelled']);
const INTAKE_SOURCES = Object.freeze(['walk_in', 'online', 'reprint']);
const DELIVERY_METHODS = Object.freeze(['pickup', 'online']);
const REQUEST_TYPES = Object.freeze(['upload', 'booking', 'both']);
const PAYMENT_KINDS = Object.freeze(['deposit', 'balance', 'refund']);
const PAYMENT_METHODS = Object.freeze(['cash', 'transfer']);
const NOTIFICATION_CHANNELS = Object.freeze(['email', 'zalo']);
const NOTIFICATION_STATUSES = Object.freeze(['pending', 'sent', 'failed', 'simulated']);
const NOTIFICATION_EVENTS = Object.freeze([
  'online_request_received',
  'online_request_accepted',
  'online_request_rejected',
  'appointment_confirmed',
  'photos_ready',
  'order_delivered',
  'order_cancelled',
  'reprint_approved'
]);
const ROLES = Object.freeze(['staff', 'admin']);

module.exports = {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_JOB_STATUSES,
  PROCESSING_PROVIDERS,
  PROCESSING_MODES,
  QC_STATUSES,
  LAYOUT_STATUSES,
  REPRINT_STATUSES,
  ONLINE_REQUEST_STATUSES,
  APPOINTMENT_STATUSES,
  INTAKE_SOURCES,
  DELIVERY_METHODS,
  REQUEST_TYPES,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_EVENTS,
  ROLES
};
