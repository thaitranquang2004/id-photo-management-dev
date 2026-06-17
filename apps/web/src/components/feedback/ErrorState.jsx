import { Alert, Button } from 'react-bootstrap';

export default function ErrorState({ error, title = 'Không tải được dữ liệu', onRetry }) {
  return (
    <Alert variant="danger" className="app-panel">
      <Alert.Heading>{title}</Alert.Heading>
      <p className="mb-2">{error?.message || 'Backend đang trả về lỗi không xác định.'}</p>
      {error?.code ? <div className="text-muted small mb-3">Mã lỗi: {error.code}</div> : null}
      {onRetry ? <Button variant="outline-danger" size="sm" onClick={onRetry}>Thử lại</Button> : null}
    </Alert>
  );
}
