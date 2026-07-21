import { Badge } from 'react-bootstrap';

const STATUS_MAP = {
  chua_kiem_tra: { label: 'Chưa kiểm tra', bg: 'light', text: 'dark' },
  dat: { label: 'QC đạt', bg: 'success' },
  canh_bao: { label: 'QC cảnh báo', bg: 'warning', text: 'dark' },
  loi: { label: 'QC lỗi', bg: 'danger' }
};

export default function QcStatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status || '-', bg: 'light', text: 'dark' };
  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
