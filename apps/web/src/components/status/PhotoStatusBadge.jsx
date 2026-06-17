import { Badge } from 'react-bootstrap';

const STATUS_MAP = {
  raw: { label: 'Ảnh gốc', bg: 'secondary' },
  processing: { label: 'Đang xử lý', bg: 'primary' },
  processed: { label: 'Đã xử lý', bg: 'info', text: 'dark' },
  approved: { label: 'Đã duyệt', bg: 'success' },
  rejected: { label: 'Từ chối', bg: 'danger' }
};

export default function PhotoStatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '-', bg: 'light', text: 'dark' };
  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
