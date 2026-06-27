import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { getOnlineRequestStatus } from '../../api/intake';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import { formatDate, formatDateOnly } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

const STATUS_LABEL = {
  new: 'Mới gửi – chờ tiếp nhận',
  accepted: 'Đã tiếp nhận',
  converted: 'Đã tạo đơn',
  rejected: 'Chưa được tiếp nhận',
  cancelled: 'Đã huỷ'
};
const APPT_LABEL = {
  requested: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  done: 'Hoàn tất',
  cancelled: 'Đã huỷ'
};

export default function OnlineRequestStatusPage() {
  const [form, setForm] = useState({ request_id: '', so_dien_thoai: '' });
  const { errors, clearError, validate } = useFormErrors();
  const statusMutation = useMutation({
    mutationFn: () => getOnlineRequestStatus(form.request_id.trim(), form.so_dien_thoai.trim())
  });
  const request = statusMutation.data?.request;

  function submit(event) {
    event.preventDefault();
    if (!validate(form, { request_id: 'Vui lòng nhập mã yêu cầu', so_dien_thoai: 'Vui lòng nhập số điện thoại' })) return;
    statusMutation.mutate();
  }

  return (
    <div className="public-page">
      <Container>
        <div className="public-topbar">
          <div className="brand-mark">
            <span className="brand-dot" />
            <span>Tiệm hình thẻ</span>
          </div>
          <div className="d-flex gap-2">
            <Button as="a" href="/dat-lich" variant="outline-primary" size="sm">Đặt lịch online</Button>
            <Button as="a" href="/tra-cuu" variant="outline-secondary" size="sm">Tra cứu đơn</Button>
          </div>
        </div>

        <Row className="justify-content-center">
          <Col lg={7}>
            <section className="app-panel public-panel">
              <div className="public-heading">
                <span className="lookup-badge">Tra cứu yêu cầu online</span>
                <h1>Trạng thái yêu cầu đặt online</h1>
                <p>Nhập mã yêu cầu (nhận được sau khi gửi) và số điện thoại để xem tình trạng.</p>
              </div>

              <Form onSubmit={submit}>
                <Row className="g-3">
                  <Col md={7}>
                    <Form.Group>
                      <Form.Label>Mã yêu cầu *</Form.Label>
                      <Form.Control
                        value={form.request_id}
                        onChange={(e) => { setForm((c) => ({ ...c, request_id: e.target.value })); clearError('request_id'); }}
                        placeholder="Dán mã yêu cầu"
                        isInvalid={!!errors.request_id}
                      />
                      <Form.Control.Feedback type="invalid">{errors.request_id}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={5}>
                    <Form.Group>
                      <Form.Label>Số điện thoại *</Form.Label>
                      <Form.Control
                        value={form.so_dien_thoai}
                        onChange={(e) => { setForm((c) => ({ ...c, so_dien_thoai: e.target.value })); clearError('so_dien_thoai'); }}
                        inputMode="tel"
                        isInvalid={!!errors.so_dien_thoai}
                      />
                      <Form.Control.Feedback type="invalid">{errors.so_dien_thoai}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                {statusMutation.error ? <Alert variant="danger" className="mt-3">{statusMutation.error.message}</Alert> : null}
                <Button type="submit" className="mt-3" disabled={statusMutation.isPending}>
                  <Search size={17} aria-hidden="true" />
                  {statusMutation.isPending ? 'Đang tra...' : 'Tra cứu'}
                </Button>
              </Form>

              {request ? (
                <div className="mt-4">
                  <div className="summary-box mb-2"><span>Tình trạng</span><strong>{STATUS_LABEL[request.trang_thai] || request.trang_thai}</strong></div>
                  <div className="summary-box mb-2"><span>Ngày gửi</span><strong>{formatDate(request.ngay_tao)}</strong></div>
                  {request.trang_thai_lich_hen ? (
                    <div className="summary-box mb-2">
                      <span>Lịch hẹn</span>
                      <strong>{formatDateOnly(request.ngay_hen)} · {request.khung_gio} · {APPT_LABEL[request.trang_thai_lich_hen] || request.trang_thai_lich_hen}</strong>
                    </div>
                  ) : null}
                  {request.ma_don_da_tao ? (
                    <Alert variant="success" className="mt-2 mb-0">
                      Đã tạo đơn <strong>{request.ma_don_da_tao}</strong>. Bạn có thể <a href="/tra-cuu">tra cứu đơn</a> để xem và tải ảnh khi sẵn sàng.
                    </Alert>
                  ) : null}
                  {request.trang_thai === 'rejected' ? (
                    <Alert variant="warning" className="mt-2 mb-0">Yêu cầu chưa được tiếp nhận. Vui lòng liên hệ tiệm để được hỗ trợ thêm.</Alert>
                  ) : null}
                </div>
              ) : null}
            </section>
          </Col>
        </Row>
      </Container>
      <PublicFooter />
    </div>
  );
}
