const ORDER_STATUSES = Object.freeze(['cho_xu_ly', 'dang_xu_ly', 'hoan_tat', 'da_giao', 'da_huy']);
const PHOTO_STATUSES = Object.freeze(['anh_goc', 'dang_xu_ly', 'da_xu_ly', 'da_duyet', 'tu_choi']);
const PROCESSING_PROVIDERS = Object.freeze(['cloudinary', 'google_ai', 'hybrid']);
const PROCESSING_MODES = Object.freeze(['safe_assist', 'quality_check_only']);
const PROCESSING_JOB_STATUSES = Object.freeze(['cho_xu_ly', 'dang_xu_ly', 'hoan_tat', 'that_bai', 'da_huy']);
const PHOTO_QC_STATUSES = Object.freeze(['chua_kiem_tra', 'dat', 'canh_bao', 'loi']);
const REPRINT_STATUSES = Object.freeze(['moi', 'da_xem', 'da_tao_don', 'tu_choi', 'hoan_tat']);
const ONLINE_REQUEST_STATUSES = Object.freeze(['moi', 'da_tiep_nhan', 'da_tao_don', 'tu_choi', 'da_huy']);
const APPOINTMENT_STATUSES = Object.freeze(['cho_xac_nhan', 'da_xac_nhan', 'tu_choi', 'da_xong', 'da_huy']);
const APPOINTMENT_TYPES = Object.freeze(['dat_lich_chup', 'hen_lay_hinh']);
const INTAKE_SOURCES = Object.freeze(['tai_tiem', 'gui_anh_tu_xa', 'in_lai']);
const DELIVERY_METHODS = Object.freeze(['lay_file_truc_tuyen', 'lay_hinh_ngay', 'hen_lay_hinh']);
const PAYMENT_KINDS = Object.freeze(['deposit', 'balance', 'refund']);
const PAYMENT_METHODS = Object.freeze(['cash', 'transfer']);
const NOTIFICATION_CHANNELS = Object.freeze(['email', 'zalo']);

module.exports = {
  ORDER_STATUSES,
  PHOTO_STATUSES,
  PROCESSING_PROVIDERS,
  PROCESSING_MODES,
  PROCESSING_JOB_STATUSES,
  PHOTO_QC_STATUSES,
  REPRINT_STATUSES,
  ONLINE_REQUEST_STATUSES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  INTAKE_SOURCES,
  DELIVERY_METHODS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  NOTIFICATION_CHANNELS
};
