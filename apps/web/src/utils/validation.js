// Client-side validation cho các form: chặn submit khi thiếu field bắt buộc và
// trả về message inline cho từng field. Tái sử dụng cùng react-bootstrap isInvalid.

// Trả về object { field: message } cho mỗi field bắt buộc bị trống hoặc không hợp lệ.
// rules: { field: 'message' }  HOẶC  { field: { message, validate?(value, values) } }
export function validateRequired(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const raw = values[field];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    const empty = value === undefined || value === null || value === '';
    const message = typeof rule === 'string' ? rule : rule.message;
    if (empty) {
      errors[field] = message;
    } else if (typeof rule === 'object' && rule.validate) {
      const custom = rule.validate(value, values);
      if (custom) errors[field] = custom;
    }
  }
  return errors;
}

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
