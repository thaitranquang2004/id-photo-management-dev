import { Badge } from 'react-bootstrap';

// Derive payment state from amount paid vs order total (no stored status column).
export default function PaymentStatusBadge({ total = 0, paid = 0 }) {
  const totalAmount = Number(total) || 0;
  const paidAmount = Number(paid) || 0;

  let meta;
  if (paidAmount <= 0) meta = { label: 'Chưa thanh toán', bg: 'danger' };
  else if (paidAmount < totalAmount) meta = { label: 'Trả một phần', bg: 'warning', text: 'dark' };
  else meta = { label: 'Đã thanh toán', bg: 'success' };

  return (
    <Badge bg={meta.bg} text={meta.text} className="status-badge">
      {meta.label}
    </Badge>
  );
}
