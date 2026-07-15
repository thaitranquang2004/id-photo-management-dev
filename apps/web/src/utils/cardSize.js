// Tỷ lệ cắt (rộng/cao) + nhãn theo ĐÚNG khổ thẻ: ưu tiên cm (vd 4×6 từ 40×60mm),
// lẻ thì để mm. Dùng chung cho crop staff (OrderDetailPage) và trang đặt lịch khách.
export function cardCropRatio(source) {
  const w = Number(source?.rong_mm);
  const h = Number(source?.cao_mm);
  if (!w || !h) return { aspect: undefined, label: '' };
  const label = w % 10 === 0 && h % 10 === 0 ? `${w / 10}×${h / 10}` : `${w}×${h}mm`;
  return { aspect: w / h, label };
}
