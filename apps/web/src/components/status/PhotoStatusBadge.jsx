import { Badge } from 'react-bootstrap';

const STATUS_MAP = {
  anh_goc: { label: 'Chờ xử lý AI', bg: 'secondary' },
  dang_xu_ly: { label: 'Đang xử lý', bg: 'primary' },
  da_xu_ly: { label: 'Đã xử lý', bg: 'info', text: 'dark' },
  da_duyet: { label: 'Đã duyệt', bg: 'success' },
  tu_choi: { label: 'Từ chối', bg: 'danger' }
};

export default function PhotoStatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '-', bg: 'light', text: 'dark' };
  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
