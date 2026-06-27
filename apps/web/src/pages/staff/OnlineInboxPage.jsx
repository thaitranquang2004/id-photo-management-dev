import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Image, Modal, Row, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { listCardTypes } from '../../api/admin';
import {
  acceptOnlineRequest,
  convertOnlineRequest,
  getOnlineRequest,
  listOnlineRequests,
  rejectOnlineRequest
} from '../../api/intake';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import PaginationBar from '../../components/common/Pagination.jsx';
import { formatDate } from '../../utils/format';

const PAGE_SIZE = 20;

const REQUEST_TYPE_LABEL = { upload: 'Gửi ảnh', booking: 'Đặt lịch', both: 'Cả hai' };
const STATUS_META = {
  new: { label: 'Mới', bg: 'primary' },
  accepted: { label: 'Đã nhận', bg: 'info', text: 'dark' },
  converted: { label: 'Đã tạo đơn', bg: 'success' },
  rejected: { label: 'Từ chối', bg: 'danger' },
  cancelled: { label: 'Đã huỷ', bg: 'secondary' }
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: 'light', text: 'dark' };
  return <Badge bg={meta.bg} text={meta.text}>{meta.label}</Badge>;
}

export default function OnlineInboxPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [convertForm, setConvertForm] = useState({ so_luong: 4, ngay_hen_lay: '', loai_the_id: '' });
  const [rejectNote, setRejectNote] = useState('');

  const listQuery = useQuery({
    queryKey: ['online-requests', statusFilter, page],
    queryFn: () => listOnlineRequests({ trang_thai: statusFilter || undefined, page, limit: PAGE_SIZE })
  });

  const cardTypesQuery = useQuery({ queryKey: ['card-types'], queryFn: listCardTypes });

  const detailQuery = useQuery({
    queryKey: ['online-requests', 'detail', selectedId],
    queryFn: () => getOnlineRequest(selectedId),
    enabled: Boolean(selectedId)
  });

  const request = detailQuery.data?.request;
  const photos = detailQuery.data?.photos || [];
  const appointment = detailQuery.data?.appointment;

  useEffect(() => {
    if (request) {
      setConvertForm((current) => ({ ...current, loai_the_id: request.loai_the_id || '' }));
      setRejectNote('');
    }
  }, [request]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['online-requests'] });
  }

  const acceptMutation = useMutation({
    mutationFn: () => acceptOnlineRequest(selectedId),
    onSuccess: invalidate
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectOnlineRequest(selectedId, rejectNote || undefined),
    onSuccess: () => { invalidate(); setSelectedId(null); }
  });

  const convertMutation = useMutation({
    mutationFn: () => convertOnlineRequest(selectedId, {
      so_luong: Number(convertForm.so_luong),
      ngay_hen_lay: convertForm.ngay_hen_lay || undefined,
      loai_the_id: convertForm.loai_the_id || undefined
    }),
    onSuccess: (result) => {
      invalidate();
      setSelectedId(null);
      if (result?.order?.id) navigate(`/staff/orders/${result.order.id}`);
    }
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const requests = listQuery.data?.online_requests || [];
  const totalPages = Math.ceil((listQuery.data?.total || 0) / PAGE_SIZE);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Hộp thư online</h1>
          <p>Yêu cầu đặt lịch và gửi ảnh từ khách. Tiếp nhận và chuyển thành đơn.</p>
        </div>
        <Form.Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 200 }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="new">Mới</option>
          <option value="accepted">Đã nhận</option>
          <option value="converted">Đã tạo đơn</option>
          <option value="rejected">Từ chối</option>
        </Form.Select>
      </div>

      <section className="app-panel">
        {listQuery.isLoading ? <LoadingState label="Đang tải yêu cầu online..." /> : null}
        {listQuery.error ? <ErrorState error={listQuery.error} onRetry={listQuery.refetch} /> : null}
        {!listQuery.isLoading && !listQuery.error && requests.length === 0 ? (
          <EmptyState title="Chưa có yêu cầu" description="Yêu cầu khách gửi từ trang Đặt online sẽ xuất hiện ở đây." />
        ) : null}
        {requests.length > 0 ? (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Khách</th>
                  <th>Loại ảnh</th>
                  <th>Hình thức</th>
                  <th>Ảnh</th>
                  <th>Trạng thái</th>
                  <th>Ngày gửi</th>
                  <th className="text-end">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="fw-semibold">{item.ho_ten}</div>
                      <div className="text-muted small">{item.so_dien_thoai}</div>
                    </td>
                    <td>{item.ten_loai_the || '-'}</td>
                    <td>{REQUEST_TYPE_LABEL[item.loai_yeu_cau] || item.loai_yeu_cau}</td>
                    <td>{item.so_anh || 0}</td>
                    <td><StatusBadge status={item.trang_thai} /></td>
                    <td>{formatDate(item.ngay_tao)}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-primary" onClick={() => setSelectedId(item.id)}>
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
        <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      <Modal show={Boolean(selectedId)} onHide={() => setSelectedId(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Yêu cầu online</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailQuery.isLoading ? <LoadingState label="Đang tải chi tiết..." /> : null}
          {request ? (
            <>
              <Row className="g-3 mb-3">
                <Col md={6}>
                  <div className="summary-box"><span>Khách</span><strong>{request.ho_ten}</strong></div>
                </Col>
                <Col md={6}>
                  <div className="summary-box"><span>SĐT</span><strong>{request.so_dien_thoai}</strong></div>
                </Col>
                <Col md={6}>
                  <div className="summary-box"><span>Email</span><strong>{request.email || '-'}</strong></div>
                </Col>
                <Col md={6}>
                  <div className="summary-box"><span>Trạng thái</span><strong><StatusBadge status={request.trang_thai} /></strong></div>
                </Col>
              </Row>

              {request.ghi_chu ? <Alert variant="light">Ghi chú khách: {request.ghi_chu}</Alert> : null}

              {appointment ? (
                <Alert variant="info">
                  Lịch hẹn: <strong>{appointment.ngay_hen}</strong> · {appointment.khung_gio} ·{' '}
                  trạng thái <strong>{appointment.trang_thai}</strong>
                </Alert>
              ) : null}

              {photos.length > 0 ? (
                <>
                  <h3 className="h6">Ảnh khách gửi ({photos.length})</h3>
                  <Row className="g-2 mb-3">
                    {photos.map((photo) => (
                      <Col xs={6} md={3} key={photo.id}>
                        {photo.metadata_anh_goc?.secure_url ? (
                          <Image src={photo.metadata_anh_goc.secure_url} alt="Ảnh khách gửi" fluid thumbnail />
                        ) : <div className="text-muted small">Không xem được</div>}
                      </Col>
                    ))}
                  </Row>
                </>
              ) : <p className="text-muted">Khách không gửi ảnh (chỉ đặt lịch).</p>}

              {request.trang_thai === 'converted' ? (
                <Alert variant="success">
                  Đã tạo đơn.{' '}
                  {request.converted_order_id ? (
                    <Button variant="link" className="p-0" onClick={() => navigate(`/staff/orders/${request.converted_order_id}`)}>
                      Mở đơn
                    </Button>
                  ) : null}
                </Alert>
              ) : null}

              {['new', 'accepted'].includes(request.trang_thai) ? (
                <div className="app-panel mt-3" style={{ background: 'var(--bs-light, #f8f9fa)' }}>
                  <h3 className="h6">Chuyển thành đơn</h3>
                  <Row className="g-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Số lượng</Form.Label>
                        <Form.Control
                          type="number"
                          min="4"
                          value={convertForm.so_luong}
                          onChange={(e) => setConvertForm((c) => ({ ...c, so_luong: e.target.value }))}
                        />
                        <Form.Text muted>Tối thiểu 4 tấm.</Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Ngày hẹn lấy</Form.Label>
                        <Form.Control
                          type="date"
                          value={convertForm.ngay_hen_lay}
                          onChange={(e) => setConvertForm((c) => ({ ...c, ngay_hen_lay: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Loại thẻ</Form.Label>
                        <Form.Select
                          value={convertForm.loai_the_id}
                          onChange={(e) => setConvertForm((c) => ({ ...c, loai_the_id: e.target.value }))}
                        >
                          <option value="">-- Chọn loại thẻ --</option>
                          {cardTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.ten}</option>)}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  {(acceptMutation.error || rejectMutation.error || convertMutation.error) ? (
                    <Alert variant="danger" className="mt-3">
                      {(acceptMutation.error || rejectMutation.error || convertMutation.error).message}
                    </Alert>
                  ) : null}
                  <Form.Group className="mt-3">
                    <Form.Label>Lý do từ chối (nếu từ chối)</Form.Label>
                    <Form.Control value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                  </Form.Group>
                </div>
              ) : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedId(null)}>Đóng</Button>
          {request && request.trang_thai === 'new' ? (
            <Button variant="outline-info" disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
              Tiếp nhận
            </Button>
          ) : null}
          {request && ['new', 'accepted'].includes(request.trang_thai) ? (
            <>
              <Button variant="outline-danger" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
                Từ chối
              </Button>
              <Button
                disabled={convertMutation.isPending || !convertForm.loai_the_id || !Number.isInteger(Number(convertForm.so_luong)) || Number(convertForm.so_luong) < 4}
                onClick={() => convertMutation.mutate()}
              >
                {convertMutation.isPending ? 'Đang tạo đơn...' : 'Tạo đơn'}
              </Button>
            </>
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
