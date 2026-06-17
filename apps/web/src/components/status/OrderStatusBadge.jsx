import { Badge } from 'react-bootstrap';

const STATUS_MAP = {
  pending: { label: 'Chờ xử lý', bg: 'warning', text: 'dark' },
  processing: { label: 'Đang xử lý', bg: 'primary' },
  completed: { label: 'Hoàn thành', bg: 'success' },
  delivered: { label: 'Đã giao', bg: 'secondary' },
  cancelled: { label: 'Đã hủy', bg: 'danger' }
};

export default function OrderStatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '-', bg: 'light', text: 'dark' };
  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
