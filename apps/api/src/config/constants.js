const ORDER_STATUSES = Object.freeze(['pending', 'processing', 'completed', 'delivered', 'cancelled']);
const PHOTO_STATUSES = Object.freeze(['raw', 'processing', 'processed', 'approved', 'rejected']);
const PROCESSING_PROVIDERS = Object.freeze(['cloudinary', 'google_ai', 'hybrid']);
const PROCESSING_MODES = Object.freeze(['safe_assist', 'quality_check_only']);
const REPRINT_STATUSES = Object.freeze(['new', 'reviewed', 'accepted', 'rejected', 'completed']);
const ONLINE_REQUEST_STATUSES = Object.freeze(['new', 'accepted', 'converted', 'rejected', 'cancelled']);
const APPOINTMENT_STATUSES = Object.freeze(['cho_xac_nhan', 'da_xac_nhan', 'tu_choi', 'da_xong', 'da_huy']);
const APPOINTMENT_TYPES = Object.freeze(['dat_lich_chup', 'hen_lay_hinh']);
const INTAKE_SOURCES = Object.freeze(['tai_tiem', 'gui_anh_tu_xa', 'in_lai']);
const DELIVERY_METHODS = Object.freeze(['lay_file_truc_tuyen', 'lay_hinh_ngay', 'hen_lay_hinh']);
const REQUEST_TYPES = Object.freeze(['upload', 'booking', 'both']);
const PAYMENT_KINDS = Object.freeze(['deposit', 'balance', 'refund']);
const PAYMENT_METHODS = Object.freeze(['cash', 'transfer']);
const NOTIFICATION_CHANNELS = Object.freeze(['email', 'zalo']);

module.exports = {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_PROVIDERS,
  PROCESSING_MODES,
  REPRINT_STATUSES,
  ONLINE_REQUEST_STATUSES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  INTAKE_SOURCES,
  DELIVERY_METHODS,
  REQUEST_TYPES,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  NOTIFICATION_CHANNELS
};
