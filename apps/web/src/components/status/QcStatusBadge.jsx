import { Badge } from 'react-bootstrap';

const STATUS_MAP = {
  not_checked: { label: 'Chưa kiểm tra', bg: 'light', text: 'dark' },
  pass: { label: 'QC đạt', bg: 'success' },
  warn: { label: 'QC cảnh báo', bg: 'warning', text: 'dark' },
  fail: { label: 'QC lỗi', bg: 'danger' }
};

export default function QcStatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '-', bg: 'light', text: 'dark' };
  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
