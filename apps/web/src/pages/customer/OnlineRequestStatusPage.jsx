import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Phone, Search } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { getOnlineRequestStatus } from '../../api/intake';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import PublicTopbar from '../../components/layout/PublicTopbar.jsx';
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
  const [form, setForm] = useState({ so_dien_thoai: '' });
  const { errors, clearError, validate } = useFormErrors();
  const statusMutation = useMutation({
    mutationFn: () => getOnlineRequestStatus(form.so_dien_thoai.trim())
  });
  const requests = statusMutation.data?.requests || [];

  function submit(event) {
    event.preventDefault();
    if (!validate(form, { so_dien_thoai: 'Vui lòng nhập số điện thoại' })) return;
    statusMutation.mutate();
  }

  return (
    <div className="public-page">
      <Container>
        <PublicTopbar />

        <Row className="g-4 align-items-stretch">
          <Col lg={5}>
            <section className="app-panel public-panel">
              <div className="public-heading">
                <span className="lookup-badge">Tra cứu yêu cầu online</span>
                <h1>Trạng thái yêu cầu đặt online</h1>
                <p>Chỉ cần nhập số điện thoại để xem tất cả yêu cầu đặt online của bạn.</p>
              </div>

              <Form onSubmit={submit}>
                <Form.Group className="mb-3">
                  <Form.Label>Số điện thoại *</Form.Label>
                  <Form.Control
                    value={form.so_dien_thoai}
                    onChange={(e) => { setForm((c) => ({ ...c, so_dien_thoai: e.target.value })); clearError('so_dien_thoai'); }}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Ví dụ: 0901234567"
                    isInvalid={!!errors.so_dien_thoai}
                  />
                  <Form.Control.Feedback type="invalid">{errors.so_dien_thoai}</Form.Control.Feedback>
                </Form.Group>
                {statusMutation.error ? <Alert variant="danger" className="mt-1 mb-3">{statusMutation.error.message}</Alert> : null}
                <Button type="submit" className="w-100" disabled={statusMutation.isPending}>
                  <Search size={17} aria-hidden="true" />
                  {statusMutation.isPending ? 'Đang tra...' : 'Tra cứu'}
                </Button>
              </Form>

              <div className="lookup-tips" aria-label="Cách xem trạng thái">
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Phone size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Nhập số điện thoại</strong>
                    <span>Số bạn đã dùng khi gửi yêu cầu đặt online.</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Search size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Xem tình trạng</strong>
                    <span>Theo dõi trạng thái tiếp nhận và lịch hẹn (nếu có).</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><CheckCircle2 size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Khi đơn sẵn sàng</strong>
                    <span>Đơn tạo xong, sang trang Tra cứu để xem &amp; tải ảnh.</span>
                  </div>
                </div>
              </div>
            </section>
          </Col>

          <Col lg={7} className="d-flex flex-column">
            <section className="app-panel public-panel flex-grow-1">
              {requests.length > 0 ? (
                <div className="public-result">
                  <h2 className="public-form-title">Kết quả tra cứu ({requests.length})</h2>
                  {requests.map((request) => (
                    <div className="reprint-box mb-3" key={request.id}>
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
                  ))}
                </div>
              ) : (
                <EmptyState title="Chưa có kết quả" description="Nhập số điện thoại rồi bấm Tra cứu để xem trạng thái các yêu cầu của bạn." />
              )}
            </section>
          </Col>
        </Row>
      </Container>
      <PublicFooter />
    </div>
  );
}
