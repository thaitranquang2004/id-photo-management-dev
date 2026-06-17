import { Spinner } from 'react-bootstrap';

export default function LoadingState({ label = 'Đang tải dữ liệu...', fullPage = false }) {
  return (
    <div className={fullPage ? 'loading-page' : 'loading-inline'} role="status" aria-live="polite">
      <Spinner animation="border" size="sm" />
      <span>{label}</span>
    </div>
  );
}
