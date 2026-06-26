import { useState } from 'react';
import { validateRequired, focusFirstInvalid } from '../utils/validation.js';

// Quản lý map lỗi theo field cho form. Dùng kèm validateRequired/focusFirstInvalid.
export function useFormErrors() {
  const [errors, setErrors] = useState({});

  // Xóa lỗi của 1 field (gọi trong onChange để chữ đỏ biến mất khi người dùng gõ lại).
  const clearError = (field) => setErrors((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });

  // Validate values theo rules; nếu lỗi: set errors + focus field đầu tiên, trả về false.
  // Hợp lệ: trả về true để handler tiếp tục submit.
  const validate = (values, rules) => {
    const validationErrors = validateRequired(values, rules);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      setTimeout(() => focusFirstInvalid(), 0);
      return false;
    }
    return true;
  };

  return { errors, setErrors, clearError, validate };
}
