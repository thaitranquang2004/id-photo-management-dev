import { Badge } from 'react-bootstrap';

const STATUS_MAP = {
  cho_xu_ly: { label: 'Chờ xử lý', bg: 'warning', text: 'dark' },
  dang_xu_ly: { label: 'Đang xử lý', bg: 'primary' },
  hoan_tat: { label: 'Hoàn thành', bg: 'success' },
  da_giao: { label: 'Đã giao', bg: 'secondary' },
  da_huy: { label: 'Đã hủy', bg: 'danger' }
};

export default function OrderStatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '-', bg: 'light', text: 'dark' };
  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
