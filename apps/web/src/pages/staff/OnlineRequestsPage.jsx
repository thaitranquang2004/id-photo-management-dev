import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { listCardTypes } from '../../api/admin.js';
import {
  acceptOnlineRequest,
  convertOnlineRequest,
  getOnlineRequest,
  listOnlineRequests,
  rejectOnlineRequest
} from '../../api/intake.js';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import PaginationBar from '../../components/common/Pagination.jsx';
import { formatDate } from '../../utils/format.js';
import { useToast } from '../../hooks/useToast.jsx';

const PAGE_SIZE = 10;
const pickupSlots = ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'];
const STATUS = {
  moi: { label: 'Mới gửi', bg: 'warning', text: 'dark' },
  da_tiep_nhan: { label: 'Đã tiếp nhận', bg: 'primary' },
  da_tao_don: { label: 'Đã tạo đơn', bg: 'success' },
  tu_choi: { label: 'Từ chối', bg: 'danger' },
  da_huy: { label: 'Đã huỷ', bg: 'secondary' }
};

function StatusBadge({ status }) {
  const meta = STATUS[status] || { label: status, bg: 'secondary' };
  return <Badge bg={meta.bg} text={meta.text}>{meta.label}</Badge>;
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

function deliveryLabel(method) {
  return method === 'hen_lay_hinh' ? 'Hẹn lấy hình in' : 'Chỉ lấy file trực tuyến';
}

export default function OnlineRequestsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [conversion, setConversion] = useState(null);

  const requestsQuery = useQuery({
    queryKey: ['online-requests', statusFilter, page],
    queryFn: () => listOnlineRequests({ trang_thai: statusFilter || undefined, page, limit: PAGE_SIZE })
  });
  const detailsQuery = useQuery({
    queryKey: ['online-request', selectedId],
    queryFn: () => getOnlineRequest(selectedId),
    enabled: Boolean(selectedId)
  });
  const cardsQuery = useQuery({ queryKey: ['card-types'], queryFn: listCardTypes });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['online-requests'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  };
  const acceptMutation = useMutation({
    mutationFn: () => acceptOnlineRequest(selectedId),
    onSuccess: () => { invalidate(); detailsQuery.refetch(); toast.success('Đã tiếp nhận yêu cầu'); }
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectOnlineRequest(selectedId, rejectNote.trim()),
    onSuccess: () => { invalidate(); detailsQuery.refetch(); toast.success('Đã từ chối yêu cầu'); }
  });
  const convertMutation = useMutation({
    mutationFn: () => convertOnlineRequest(selectedId, conversion),
    onSuccess: (result) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Đã tạo đơn từ yêu cầu online');
      setSelectedId(null);
      navigate(`/staff/orders/${result.order.id}`);
    }
  });

  const detail = detailsQuery.data;
  const request = detail?.request;
  const cards = cardsQuery.data?.card_types || [];
  const requests = requestsQuery.data?.online_requests || [];
  const totalPages = Math.ceil((requestsQuery.data?.total || 0) / PAGE_SIZE);
  const isPickup = conversion?.hinh_thuc_giao === 'hen_lay_hinh';

  useEffect(() => {
    if (!request) return;
    setConversion({
      loai_the_id: request.loai_the_id || '',
      hinh_thuc_giao: request.hinh_thuc_giao || 'lay_file_truc_tuyen',
      so_luong: request.hinh_thuc_giao === 'hen_lay_hinh' ? request.so_luong || 4 : undefined,
      ngay_hen_lay: dateInputValue(request.ngay_hen_lay),
      khung_gio_lay: request.khung_gio_lay || '',
      ghi_chu: request.ghi_chu || ''
    });
  }, [request]);

  function closeDetail() {
    setSelectedId(null);
    setRejectNote('');
    setConversion(null);
  }

  function updateConversion(event) {
    const { name, value } = event.target;
    setConversion((current) => ({
      ...current,
      [name]: name === 'so_luong' ? Number(value) : value,
      ...(name === 'hinh_thuc_giao' && value === 'lay_file_truc_tuyen'
        ? { so_luong: undefined, ngay_hen_lay: '', khung_gio_lay: '' }
        : {})
    }));
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Yêu cầu gửi ảnh online</h1>
          <p>Tiếp nhận ảnh khách gửi, kiểm tra thông tin và tạo đơn khi sẵn sàng.</p>
        </div>
        <Form.Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} style={{ maxWidth: 210 }}>
          <option value="">Tất cả trạng thái</option>
          <option value="moi">Mới gửi</option>
          <option value="da_tiep_nhan">Đã tiếp nhận</option>
          <option value="da_tao_don">Đã tạo đơn</option>
          <option value="tu_choi">Từ chối</option>
        </Form.Select>
      </div>

      <section className="app-panel">
        {requestsQuery.isLoading ? <LoadingState label="Đang tải yêu cầu online..." /> : null}
        {requestsQuery.error ? <ErrorState error={requestsQuery.error} onRetry={requestsQuery.refetch} /> : null}
        {!requestsQuery.isLoading && !requestsQuery.error && requests.length === 0 ? <EmptyState title="Chưa có yêu cầu gửi ảnh" description="Yêu cầu khách gửi từ trang Gửi ảnh sẽ xuất hiện ở đây." /> : null}
        {requests.length > 0 ? (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead><tr><th>Khách</th><th>Loại thẻ</th><th>Nhận ảnh</th><th>Ảnh</th><th>Trạng thái</th><th>Ngày gửi</th><th /></tr></thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td><div className="fw-semibold">{item.ho_ten}</div><div className="text-muted small">{item.so_dien_thoai}</div></td>
                    <td>{item.ten_loai_the || 'Chưa chọn'}</td>
                    <td><div>{deliveryLabel(item.hinh_thuc_giao)}</div>{item.hinh_thuc_giao === 'hen_lay_hinh' ? <div className="text-muted small">{item.so_luong} tấm · {dateInputValue(item.ngay_hen_lay)} · {item.khung_gio_lay}</div> : null}</td>
                    <td>{item.so_anh}</td>
                    <td><StatusBadge status={item.trang_thai} /></td>
                    <td>{formatDate(item.ngay_tao)}</td>
                    <td className="text-end"><Button variant="outline-primary" size="sm" onClick={() => setSelectedId(item.id)}>Xem & xử lý</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
        <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      <Modal show={Boolean(selectedId)} onHide={closeDetail} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Yêu cầu gửi ảnh online</Modal.Title></Modal.Header>
        <Modal.Body>
          {detailsQuery.isLoading ? <LoadingState label="Đang tải chi tiết..." /> : null}
          {request ? (
            <>
              <Row className="g-2 mb-3">
                <Col md={6}><div className="summary-box"><span>Khách</span><strong>{request.ho_ten}</strong><small>{request.so_dien_thoai} · {request.email}</small></div></Col>
                <Col md={6}><div className="summary-box"><span>Trạng thái</span><strong><StatusBadge status={request.trang_thai} /></strong></div></Col>
              </Row>
              <h3 className="h6">Ảnh khách gửi ({detail.photos?.length || 0})</h3>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {(detail.photos || []).map((photo) => (
                  <a key={photo.id} href={photo.metadata_anh_goc?.secure_url} target="_blank" rel="noreferrer" className="border rounded overflow-hidden bg-light">
                    {photo.metadata_anh_goc?.secure_url ? <img src={photo.metadata_anh_goc.secure_url} alt="Ảnh khách gửi" style={{ width: 96, height: 128, objectFit: 'cover' }} /> : <span className="d-block p-3">Ảnh</span>}
                  </a>
                ))}
              </div>
              {request.trang_thai === 'da_tiep_nhan' ? (
                <Form>
                  <h3 className="h6">Thông tin đơn sẽ tạo</h3>
                  <Row className="g-3">
                    <Col md={6}><Form.Group><Form.Label>Loại thẻ</Form.Label><Form.Select name="loai_the_id" value={conversion?.loai_the_id || ''} onChange={updateConversion}>{cards.map((card) => <option key={card.id} value={card.id}>{card.ten}</option>)}</Form.Select></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Hình thức giao</Form.Label><Form.Select name="hinh_thuc_giao" value={conversion?.hinh_thuc_giao || ''} onChange={updateConversion}><option value="lay_file_truc_tuyen">Chỉ lấy file trực tuyến</option><option value="hen_lay_hinh">Hẹn lấy hình in</option></Form.Select></Form.Group></Col>
                    {isPickup ? <><Col md={4}><Form.Group><Form.Label>Số lượng</Form.Label><Form.Control min="4" type="number" name="so_luong" value={conversion?.so_luong || 4} onChange={updateConversion} /></Form.Group></Col><Col md={4}><Form.Group><Form.Label>Ngày lấy</Form.Label><Form.Control type="date" name="ngay_hen_lay" value={conversion?.ngay_hen_lay || ''} onChange={updateConversion} /></Form.Group></Col><Col md={4}><Form.Group><Form.Label>Khung giờ</Form.Label><Form.Select name="khung_gio_lay" value={conversion?.khung_gio_lay || ''} onChange={updateConversion}><option value="">Chọn giờ</option>{pickupSlots.map((slot) => <option key={slot}>{slot}</option>)}</Form.Select></Form.Group></Col></> : null}
                    <Col xs={12}><Form.Group><Form.Label>Ghi chú đơn</Form.Label><Form.Control as="textarea" rows={2} name="ghi_chu" value={conversion?.ghi_chu || ''} onChange={updateConversion} /></Form.Group></Col>
                  </Row>
                </Form>
              ) : null}
              {['moi', 'da_tiep_nhan'].includes(request.trang_thai) ? <Form.Group className="mt-3"><Form.Label>Lý do từ chối</Form.Label><Form.Control as="textarea" rows={2} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} /></Form.Group> : null}
              {request.don_da_tao_id ? <Alert variant="success" className="mt-3 mb-0">Đã tạo đơn. <Link to={`/staff/orders/${request.don_da_tao_id}`}>Mở đơn</Link></Alert> : null}
              {(acceptMutation.error || rejectMutation.error || convertMutation.error) ? <Alert variant="danger" className="mt-3 mb-0">{(acceptMutation.error || rejectMutation.error || convertMutation.error).message}</Alert> : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeDetail}>Đóng</Button>
          {request?.trang_thai === 'moi' ? <Button disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>Tiếp nhận</Button> : null}
          {['moi', 'da_tiep_nhan'].includes(request?.trang_thai) ? <Button variant="outline-danger" disabled={rejectMutation.isPending || !rejectNote.trim()} onClick={() => rejectMutation.mutate()}>Từ chối</Button> : null}
          {request?.trang_thai === 'da_tiep_nhan' ? <Button variant="success" disabled={convertMutation.isPending} onClick={() => convertMutation.mutate()}>{convertMutation.isPending ? 'Đang tạo đơn...' : 'Tạo đơn'}</Button> : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
