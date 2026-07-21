// Client-side validation cho các form: chặn submit khi thiếu field bắt buộc và
// trả về message inline cho từng field. Tái sử dụng cùng react-bootstrap isInvalid.

// Trả về object { field: message } cho mỗi field bắt buộc bị trống hoặc không hợp lệ.
// rules: { field: 'message' }  HOẶC  { field: { message, required?, validate?(value, values) } }
export function validateRequired(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const raw = values[field];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    const empty = value === undefined || value === null || value === '';
    const message = typeof rule === 'string' ? rule : rule.message;
    const required = typeof rule !== 'object' || rule.required !== false;
    if (empty) {
      if (required) errors[field] = message;
    } else if (typeof rule === 'object' && rule.validate) {
      const custom = rule.validate(value, values);
      if (custom) errors[field] = custom;
    }
  }
  return errors;
}

export function normalizeVietnamesePhone(value = '') {
  return String(value).trim().replace(/[()\-\s.]/g, '');
}

export function isValidVietnamesePhone(value) {
  return /^(?:0\d{9,10}|\+84\d{9,10})$/.test(normalizeVietnamesePhone(value));
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export const vietnamesePhoneRule = {
  message: 'Vui lòng nhập số điện thoại',
  validate: (value) => (isValidVietnamesePhone(value)
    ? null
    : 'Số điện thoại phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx')
};

export const emailRule = {
  message: 'Vui lòng nhập email',
  validate: (value) => (isValidEmail(value) ? null : 'Email không đúng định dạng')
};

export const optionalEmailRule = {
  message: 'Email không đúng định dạng',
  required: false,
  validate: (value) => (isValidEmail(value) ? null : 'Email không đúng định dạng')
};

// Focus + cuộn tới control lỗi đầu tiên (.is-invalid). Gọi trong setTimeout(…, 0)
// để React kịp render class .is-invalid trước khi truy vấn DOM.
export function focusFirstInvalid(container) {
  const root = container || document;
  const el = root.querySelector('.is-invalid');
  if (el) {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
