import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Phone, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Badge, Button, Col, Container, Form, Row, Table } from 'react-bootstrap';
import { getOnlineRequestStatus } from '../../api/intake';
import PaginationBar from '../../components/common/Pagination.jsx';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import PublicTopbar from '../../components/layout/PublicTopbar.jsx';
import { formatDate, formatDateOnly } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { vietnamesePhoneRule } from '../../utils/validation.js';

const STATUS_LABEL = {
  moi: 'Mới gửi – chờ tiếp nhận',
  da_tiep_nhan: 'Đã tiếp nhận',
  da_tao_don: 'Đã tạo đơn',
  tu_choi: 'Chưa được tiếp nhận',
  da_huy: 'Đã huỷ',
  cho_xu_ly: 'Chờ xử lý',
  dang_xu_ly: 'Đang xử lý',
  hoan_tat: 'Hoàn tất',
  da_giao: 'Đã giao',
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  tu_choi: 'Đã từ chối',
  da_xong: 'Hoàn tất',
  da_huy: 'Đã huỷ'
};
const STATUS_VARIANT = {
  moi: 'warning',
  da_tiep_nhan: 'primary',
  da_tao_don: 'success',
  tu_choi: 'danger',
  da_huy: 'secondary',
  cho_xu_ly: 'warning',
  dang_xu_ly: 'primary',
  hoan_tat: 'success',
  da_giao: 'secondary',
  cho_xac_nhan: 'warning',
  da_xac_nhan: 'primary',
  tu_choi: 'danger',
  da_xong: 'success',
  da_huy: 'secondary'
};
const APPT_LABEL = {
  requested: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  done: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  da_xong: 'Hoàn tất',
  da_huy: 'Đã huỷ'
};
const ONLINE_REQUEST_TYPE_LABEL = {
  upload: 'Gửi ảnh',
  booking: 'Đặt lịch',
  both: 'Gửi ảnh & đặt lịch'
};
const RECORD_TYPE_LABEL = {
  dat_lich_chup: 'Đặt lịch chụp',
  gui_anh_tu_xa: 'Gửi ảnh rửa',
  yeu_cau_online: 'Yêu cầu online'
};
const REQUESTS_PER_PAGE = 4;

function requestTypeLabel(request) {
  if (request.loai_ban_ghi === 'yeu_cau_online' && request.loai_yeu_cau) {
    return `${RECORD_TYPE_LABEL.yeu_cau_online} – ${ONLINE_REQUEST_TYPE_LABEL[request.loai_yeu_cau] || request.loai_yeu_cau}`;
  }
  return RECORD_TYPE_LABEL[request.loai_ban_ghi] || 'Yêu cầu';
}

export default function OnlineRequestStatusPage() {
  const [form, setForm] = useState({ so_dien_thoai: '' });
  const [requestsPage, setRequestsPage] = useState(1);
  const resultsRef = useRef(null);
  const { errors, clearError, validate } = useFormErrors();
  const statusMutation = useMutation({
    mutationFn: () => getOnlineRequestStatus(form.so_dien_thoai.trim()),
    onSuccess: () => setRequestsPage(1)
  });
  const requests = statusMutation.data?.requests || [];
  const hasResults = requests.length > 0;
  const totalRequestPages = Math.ceil(requests.length / REQUESTS_PER_PAGE);
  const currentRequestPage = Math.min(requestsPage, Math.max(totalRequestPages, 1));
  const pagedRequests = requests.slice(
    (currentRequestPage - 1) * REQUESTS_PER_PAGE,
    currentRequestPage * REQUESTS_PER_PAGE
  );

  function submit(event) {
    event.preventDefault();
    if (!validate(form, { so_dien_thoai: vietnamesePhoneRule })) return;
    setRequestsPage(1);
    statusMutation.mutate();
  }

  function changeRequestsPage(page) {
    setRequestsPage(page);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="public-page">
      <Container>
        <PublicTopbar />

        <Row className={`g-4 ${hasResults ? 'align-items-start' : 'align-items-stretch'}`}>
          <Col lg={5}>
            <section className="app-panel public-panel">
              <div className="public-heading">
                <span className="lookup-badge">Kiểm tra yêu cầu</span>
                <h1>Trạng thái yêu cầu của bạn</h1>
                <p>Nhập số điện thoại để xem lịch chụp, yêu cầu gửi ảnh và yêu cầu online của bạn.</p>
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
                    <span>Số bạn đã dùng khi đặt lịch hoặc gửi ảnh cho tiệm.</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Search size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Xem tình trạng</strong>
                    <span>Theo dõi trạng thái đơn, yêu cầu và lịch hẹn (nếu có).</span>
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

          <Col lg={7} className={hasResults ? undefined : 'd-flex'}>
            <section className={`app-panel public-panel${hasResults ? '' : ' flex-grow-1'}`}>
              {requests.length > 0 ? (
                <div className="public-result" ref={resultsRef}>
                  <h2 className="public-form-title">Kết quả tra cứu ({requests.length})</h2>
                  <div className="table-responsive">
                    <Table hover className="data-table public-request-table">
                      <thead>
                        <tr>
                          <th>Loại yêu cầu</th>
                          <th>Tình trạng</th>
                          <th>Ngày gửi</th>
                          <th>Lịch hẹn</th>
                          <th>Thông tin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRequests.map((request) => (
                          <tr key={`${request.loai_ban_ghi}-${request.id}`}>
                            <td>{requestTypeLabel(request)}</td>
                            <td>
                              <Badge bg={STATUS_VARIANT[request.trang_thai] || 'secondary'} className="status-badge">
                                {STATUS_LABEL[request.trang_thai] || request.trang_thai}
                              </Badge>
                            </td>
                            <td>{formatDate(request.ngay_tao)}</td>
                            <td>
                              {request.trang_thai_lich_hen ? (
                                <div className="public-request-appointment">
                                  <strong>{formatDateOnly(request.ngay_hen)} · {request.khung_gio}</strong>
                                  <span>{APPT_LABEL[request.trang_thai_lich_hen] || request.trang_thai_lich_hen}</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td>
                              {request.ma_don_da_tao ? (
                                <span>Đơn <a href="/tra-cuu">{request.ma_don_da_tao}</a></span>
                              ) : request.trang_thai === 'tu_choi' ? (
                                <span className="text-muted">Chưa tiếp nhận. Vui lòng liên hệ tiệm.</span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <PaginationBar page={currentRequestPage} totalPages={totalRequestPages} onChange={changeRequestsPage} />
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
