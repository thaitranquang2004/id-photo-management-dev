import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { createAppointment, listAppointments, updateAppointmentStatus } from '../../api/intake';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import PaginationBar from '../../components/common/Pagination.jsx';
import { formatDateOnly } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { TIME_SLOTS } from '../../utils/constants.js';

const PAGE_SIZE = 20;
const EMPTY_CREATE = { customer_name: '', phone: '', preferred_date: '', time_slot: '', note: '' };

const STATUS_META = {
  requested: { label: 'Chờ xác nhận', bg: 'primary' },
  confirmed: { label: 'Đã xác nhận', bg: 'info', text: 'dark' },
  done: { label: 'Hoàn tất', bg: 'success' },
  cancelled: { label: 'Đã huỷ', bg: 'secondary' }
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: 'light', text: 'dark' };
  return <Badge bg={meta.bg} text={meta.text}>{meta.label}</Badge>;
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const { errors, setErrors, clearError, validate } = useFormErrors();

  const listQuery = useQuery({
    queryKey: ['appointments', statusFilter, page],
    queryFn: () => listAppointments({ status: statusFilter || undefined, page, limit: PAGE_SIZE })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAppointmentStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] })
  });

  const createMutation = useMutation({
    mutationFn: () => createAppointment({
      customer_name: createForm.customer_name || undefined,
      phone: createForm.phone || undefined,
      preferred_date: createForm.preferred_date,
      time_slot: createForm.time_slot,
      note: createForm.note || undefined
    }),
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  });

  const appointments = listQuery.data?.appointments || [];
  const totalPages = Math.ceil((listQuery.data?.total || 0) / PAGE_SIZE);

  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setErrors({});
    setShowCreate(true);
  }

  function handleCreate() {
    if (!validate(createForm, { preferred_date: 'Vui lòng chọn ngày hẹn', time_slot: 'Vui lòng chọn khung giờ' })) return;
    createMutation.mutate();
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Lịch hẹn</h1>
          <p>Lịch khách đặt đến chụp. Xác nhận hoặc đánh dấu hoàn tất.</p>
        </div>
        <div className="header-actions">
          <Button onClick={openCreate}>Tạo lịch hẹn</Button>
          <Form.Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="requested">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="done">Hoàn tất</option>
            <option value="cancelled">Đã huỷ</option>
          </Form.Select>
        </div>
      </div>

      <section className="app-panel">
        {listQuery.isLoading ? <LoadingState label="Đang tải lịch hẹn..." /> : null}
        {listQuery.error ? <ErrorState error={listQuery.error} onRetry={listQuery.refetch} /> : null}
        {!listQuery.isLoading && !listQuery.error && appointments.length === 0 ? (
          <EmptyState title="Chưa có lịch hẹn" description="Lịch khách đặt từ trang Đặt online sẽ xuất hiện ở đây." />
        ) : null}
        {appointments.length > 0 ? (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Khách</th>
                  <th>Ngày hẹn</th>
                  <th>Khung giờ</th>
                  <th>Đơn</th>
                  <th>Trạng thái</th>
                  <th className="text-end">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="fw-semibold">{item.customer_name || '-'}</div>
                      <div className="text-muted small">{item.phone || '-'}</div>
                    </td>
                    <td>{formatDateOnly(item.preferred_date)}</td>
                    <td>{item.time_slot}</td>
                    <td>
                      {item.order_id ? (
                        <Link to={`/staff/orders/${item.order_id}`}>{item.order_code || 'Mở đơn'}</Link>
                      ) : '-'}
                    </td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="text-end">
                      <div className="table-actions">
                        {item.status === 'requested' ? (
                          <Button
                            size="sm"
                            variant="outline-info"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: item.id, status: 'confirmed' })}
                          >
                            Xác nhận
                          </Button>
                        ) : null}
                        {item.status === 'confirmed' ? (
                          <Button
                            size="sm"
                            variant="outline-success"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: item.id, status: 'done' })}
                          >
                            Hoàn tất
                          </Button>
                        ) : null}
                        {['requested', 'confirmed'].includes(item.status) ? (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: item.id, status: 'cancelled' })}
                          >
                            Huỷ
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
        <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
        {statusMutation.error ? <ErrorState error={statusMutation.error} /> : null}
      </section>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Tạo lịch hẹn tại quầy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Tên khách</Form.Label>
                <Form.Control value={createForm.customer_name} onChange={(e) => setCreateForm((c) => ({ ...c, customer_name: e.target.value }))} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Số điện thoại</Form.Label>
                <Form.Control value={createForm.phone} onChange={(e) => setCreateForm((c) => ({ ...c, phone: e.target.value }))} inputMode="tel" />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Ngày hẹn *</Form.Label>
                <Form.Control
                  type="date"
                  value={createForm.preferred_date}
                  onChange={(e) => { setCreateForm((c) => ({ ...c, preferred_date: e.target.value })); clearError('preferred_date'); }}
                  isInvalid={!!errors.preferred_date}
                />
                <Form.Control.Feedback type="invalid">{errors.preferred_date}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Khung giờ *</Form.Label>
                <Form.Select
                  value={createForm.time_slot}
                  onChange={(e) => { setCreateForm((c) => ({ ...c, time_slot: e.target.value })); clearError('time_slot'); }}
                  isInvalid={!!errors.time_slot}
                >
                  <option value="">-- Chọn khung giờ --</option>
                  {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.time_slot}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Ghi chú</Form.Label>
                <Form.Control as="textarea" rows={2} value={createForm.note} onChange={(e) => setCreateForm((c) => ({ ...c, note: e.target.value }))} />
              </Form.Group>
            </Col>
          </Row>
          {createMutation.error ? <Alert variant="danger" className="mt-3">{createMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Đóng</Button>
          <Button disabled={createMutation.isPending} onClick={handleCreate}>
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo lịch hẹn'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
