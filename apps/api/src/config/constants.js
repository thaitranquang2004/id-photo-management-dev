const ORDER_STATUSES = Object.freeze(['pending', 'processing', 'completed', 'delivered', 'cancelled']);
const PHOTO_STATUSES = Object.freeze(['raw', 'processing', 'processed', 'approved', 'rejected']);
const PROCESSING_JOB_STATUSES = Object.freeze(['queued', 'processing', 'completed', 'failed', 'cancelled']);
const PROCESSING_PROVIDERS = Object.freeze(['cloudinary', 'google_ai', 'hybrid']);
const LAYOUT_STATUSES = Object.freeze(['generated', 'needs_fix', 'archived']);
const REPRINT_STATUSES = Object.freeze(['new', 'reviewed', 'accepted', 'rejected', 'completed']);
const EXPORT_JOB_STATUSES = Object.freeze(['queued', 'processing', 'completed', 'failed', 'cancelled']);
const ROLES = Object.freeze(['staff', 'admin']);

module.exports = {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_JOB_STATUSES,
  PROCESSING_PROVIDERS,
  LAYOUT_STATUSES,
  REPRINT_STATUSES,
  EXPORT_JOB_STATUSES,
  ROLES
};
