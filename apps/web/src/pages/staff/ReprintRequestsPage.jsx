import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  listReprintRequests,
  getReprintRequest,
  updateReprintStatus,
  convertReprintToOrder
} from '../../api/reprints';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import PaginationBar from '../../components/common/Pagination.jsx';
import { formatDate } from '../../utils/format';

const PAGE_SIZE = 20;
const STATUS_META = {
  new: { label: 'Mới', bg: 'primary' },
  reviewed: { label: 'Đã xem', bg: 'info', text: 'dark' },
  accepted: { label: 'Đã tạo đơn', bg: 'success' },
  rejected: { label: 'Từ chối', bg: 'danger' },
  completed: { label: 'Hoàn tất', bg: 'secondary' }
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: 'light', text: 'dark' };
  return <Badge bg={meta.bg} text={meta.text}>{meta.label}</Badge>;
}

export default function ReprintRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const listQuery = useQuery({
    queryKey: ['reprint-requests', statusFilter, page],
    queryFn: () => listReprintRequests({ status: statusFilter || undefined, page, limit: PAGE_SIZE })
  });

  const detailQuery = useQuery({
    queryKey: ['reprint-requests', 'detail', selectedId],
    queryFn: () => getReprintRequest(selectedId),
    enabled: Boolean(selectedId)
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reprint-requests'] });

  const statusMutation = useMutation({
    mutationFn: ({ status, note }) => updateReprintStatus(selectedId, { status, note }),
    onSuccess: invalidate
  });

  const convertMutation = useMutation({
    mutationFn: () => convertReprintToOrder(selectedId, {}),
    onSuccess: invalidate
  });

  const requests = listQuery.data?.requests || [];
  const totalPages = Math.ceil((listQuery.data?.total || 0) / PAGE_SIZE);
  const detail = detailQuery.data;
  const request = detail?.request;
  const photos = detail?.photos || [];
  const actionable = request && !request.don_in_lai_id && ['new', 'reviewed'].includes(request.trang_thai);

  function closeDetail() {
    setSelectedId(null);
    setRejectNote('');
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Yêu cầu in lại</h1>
          <p>Khách yêu cầu in lại từ trang tra cứu. Duyệt và tạo đơn in lại có tính tiền.</p>
        </div>
        <Form.Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 200 }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="new">Mới</option>
          <option value="reviewed">Đã xem</option>
          <option value="accepted">Đã tạo đơn</option>
          <option value="rejected">Từ chối</option>
          <option value="completed">Hoàn tất</option>
        </Form.Select>
      </div>

      <section className="app-panel">
        {listQuery.isLoading ? <LoadingState label="Đang tải yêu cầu in lại..." /> : null}
        {listQuery.error ? <ErrorState error={listQuery.error} onRetry={listQuery.refetch} /> : null}
        {!listQuery.isLoading && !listQuery.error && requests.length === 0 ? (
          <EmptyState title="Chưa có yêu cầu in lại" description="Yêu cầu khách gửi từ trang tra cứu sẽ xuất hiện ở đây." />
        ) : null}
        {requests.length > 0 ? (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Mã đơn gốc</th>
                  <th>SĐT</th>
                  <th>Số lượng</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Ngày gửi</th>
                  <th className="text-end">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td className="fw-semibold">{item.ma_don || '-'}</td>
                    <td>{item.so_dien_thoai || '-'}</td>
                    <td>{item.so_luong}</td>
                    <td>{item.ly_do || item.ghi_chu || '-'}</td>
                    <td><StatusBadge status={item.trang_thai} /></td>
                    <td>{formatDate(item.ngay_tao)}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-primary" onClick={() => setSelectedId(item.id)}>Chi tiết</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
        <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      <Modal show={Boolean(selectedId)} onHide={closeDetail} centered>
        <Modal.Header closeButton>
          <Modal.Title>Yêu cầu in lại</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailQuery.isLoading ? <LoadingState label="Đang tải..." /> : null}
          {request ? (
            <>
              <div className="summary-box mb-2"><span>Đơn gốc</span><strong>{request.ma_don || detail?.order?.ma_don || '-'}</strong></div>
              <div className="summary-box mb-2"><span>SĐT</span><strong>{request.so_dien_thoai || '-'}</strong></div>
              <div className="summary-box mb-2"><span>Số lượng</span><strong>{request.so_luong}</strong></div>
              <div className="summary-box mb-2"><span>Số ảnh yêu cầu</span><strong>{photos.length}</strong></div>
              <div className="summary-box mb-2"><span>Lý do</span><strong>{request.ly_do || '-'}</strong></div>
              {request.ghi_chu ? <div className="summary-box mb-2"><span>Ghi chú</span><strong>{request.ghi_chu}</strong></div> : null}
              <div className="summary-box mb-2"><span>Trạng thái</span><strong><StatusBadge status={request.trang_thai} /></strong></div>

              {request.don_in_lai_id ? (
                <Alert variant="success" className="mt-2 mb-0">
                  Đã tạo đơn in lại.{' '}
                  <Link to={`/staff/orders/${request.don_in_lai_id}`}>Mở đơn in lại</Link>
                </Alert>
              ) : null}

              {actionable ? (
                <Form.Group className="mt-3">
                  <Form.Label>Lý do từ chối (nếu từ chối)</Form.Label>
                  <Form.Control as="textarea" rows={2} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                </Form.Group>
              ) : null}

              {(statusMutation.error || convertMutation.error) ? (
                <Alert variant="danger" className="mt-2 mb-0">{(statusMutation.error || convertMutation.error).message}</Alert>
              ) : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeDetail}>Đóng</Button>
          {actionable ? (
            <>
              {request.trang_thai === 'new' ? (
                <Button variant="outline-info" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ trang_thai: 'reviewed' })}>
                  Đã xem
                </Button>
              ) : null}
              <Button
                variant="outline-danger"
                disabled={statusMutation.isPending || !rejectNote.trim()}
                onClick={() => statusMutation.mutate({ trang_thai: 'rejected', ghi_chu: rejectNote })}
              >
                Từ chối
              </Button>
              <Button disabled={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
                {convertMutation.isPending ? 'Đang tạo...' : 'Tạo đơn in lại'}
              </Button>
            </>
          ) : null}
          {request && request.trang_thai === 'accepted' && request.don_in_lai_id ? (
            <Button variant="outline-success" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ trang_thai: 'completed' })}>
              Đánh dấu hoàn tất
            </Button>
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
