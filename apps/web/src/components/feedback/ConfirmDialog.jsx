import { Modal, Button, Spinner } from 'react-bootstrap';

// Hộp thoại xác nhận dùng chung (vd đăng xuất, xoá...). Dựng bằng react-bootstrap Modal.
export default function ConfirmDialog({
  show,
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
