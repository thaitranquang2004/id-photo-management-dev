import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import {
  createAdminUser,
  listAdminUsers,
  resetUserPassword,
  updateAdminUser
} from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatDate } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

const emptyForm = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'staff',
  is_active: true
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const createErrors = useFormErrors();
  const editErrors = useFormErrors();
  const query = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => listAdminUsers({ limit: 100 })
  });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      setShowCreate(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminUser(id, payload),
    onSuccess: () => {
      setConfirmAction(null);
      setSelectedUser(null);
      setEditForm(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });

  const resetMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: () => setConfirmAction(null)
  });

  if (query.isLoading) return <LoadingState label="Đang tải nhân viên..." />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const users = query.data?.data?.users || [];

  function submitCreate(event) {
    event.preventDefault();
    if (!createErrors.validate(form, { full_name: 'Vui lòng nhập họ tên', email: 'Vui lòng nhập email' })) return;
    createMutation.mutate({
      ...form,
      password: form.password || undefined
    });
  }

  function openEdit(user) {
    setSelectedUser(user);
    editErrors.setErrors({});
    setEditForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role || 'staff',
      is_active: Boolean(user.is_active)
    });
  }

  function closeEdit() {
    setSelectedUser(null);
    setEditForm(null);
  }

  function submitEdit(event) {
    event.preventDefault();
    if (!selectedUser || !editForm) return;

    if (!editErrors.validate(editForm, { full_name: 'Vui lòng nhập họ tên' })) return;

    const payload = {};
    if (editForm.full_name !== (selectedUser.full_name || '')) payload.full_name = editForm.full_name;
    if (editForm.phone !== (selectedUser.phone || '')) payload.phone = editForm.phone;
    if (editForm.role !== selectedUser.role) payload.role = editForm.role;
    if (editForm.is_active !== Boolean(selectedUser.is_active)) payload.is_active = editForm.is_active;

    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }

    setConfirmAction({
      type: 'update',
      id: selectedUser.id,
      payload,
      title: 'Xác nhận sửa nhân viên',
      description: `Bạn chắc chắn muốn cập nhật thông tin của ${selectedUser.full_name || selectedUser.email || selectedUser.id}?`
    });
  }

  function requestPasswordReset(user) {
    setConfirmAction({
      type: 'reset-password',
      id: user.id,
      title: 'Xác nhận reset password',
      description: `Bạn chắc chắn muốn tạo yêu cầu reset password cho ${user.full_name || user.email || user.id}?`
    });
  }

  function confirmSubmit() {
    if (!confirmAction) return;
    if (confirmAction.type === 'update') {
      updateMutation.mutate({ id: confirmAction.id, payload: confirmAction.payload });
    }
    if (confirmAction.type === 'reset-password') {
      resetMutation.mutate(confirmAction.id);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Nhân viên</h1>
          <p>Quản lý profile nội bộ, role và trạng thái tài khoản.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); createErrors.setErrors({}); setShowCreate(true); }} className="button-nowrap">
          <Plus size={17} aria-hidden="true" />
          Thêm nhân viên
        </Button>
      </div>

      {updateMutation.error ? <Alert variant="danger">{updateMutation.error.message}</Alert> : null}
      {resetMutation.data ? <Alert variant="info">{resetMutation.data.message}</Alert> : null}
      {resetMutation.error ? <Alert variant="danger">{resetMutation.error.message}</Alert> : null}

      <section className="app-panel">
        {users.length === 0 ? (
          <EmptyState title="Chưa có nhân viên" />
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email/User ID</th>
                  <th>SĐT</th>
                  <th>Role</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="clickable-row" onDoubleClick={() => openEdit(user)}>
                    <td className="fw-semibold">{user.full_name || '-'}</td>
                    <td className="small">{user.email || user.id}</td>
                    <td>{user.phone || '-'}</td>
                    <td><Badge bg={user.role === 'admin' ? 'primary' : 'secondary'}>{user.role}</Badge></td>
                    <td>
                      {user.is_active ? <Badge bg="success">active</Badge> : <Badge bg="secondary">disabled</Badge>}
                    </td>
                    <td>{formatDate(user.created_at)}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-primary" onClick={() => openEdit(user)}>
                        <Pencil size={15} aria-hidden="true" />
                        Xem / sửa
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Thêm nhân viên mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submitCreate}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Họ tên</Form.Label>
                  <Form.Control
                    value={form.full_name}
                    onChange={(event) => { setForm((current) => ({ ...current, full_name: event.target.value })); createErrors.clearError('full_name'); }}
                    isInvalid={!!createErrors.errors.full_name}
                  />
                  <Form.Control.Feedback type="invalid">{createErrors.errors.full_name}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={form.email}
                    onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); createErrors.clearError('email'); }}
                    isInvalid={!!createErrors.errors.email}
                  />
                  <Form.Control.Feedback type="invalid">{createErrors.errors.email}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>SĐT</Form.Label>
                  <Form.Control value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Mật khẩu tạm thời</Form.Label>
                  <Form.Control type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Tối thiểu 8 ký tự nếu đặt ngay" />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Check
                  checked={form.is_active}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  label="Kích hoạt tài khoản"
                />
              </Col>
            </Row>
            {createMutation.error ? <Alert variant="danger" className="mt-3">{createMutation.error.message}</Alert> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Đóng</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Save size={16} aria-hidden="true" />
              Lưu
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(selectedUser)} onHide={closeEdit} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Thông tin nhân viên</Modal.Title>
        </Modal.Header>
        {selectedUser && editForm ? (
          <Form onSubmit={submitEdit}>
            <Modal.Body>
              <Row className="g-3">
                <Col md={6}>
                  <div className="summary-box">
                    <span>Email/User ID</span>
                    <strong>{selectedUser.email || selectedUser.id}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="summary-box">
                    <span>Ngày tạo</span>
                    <strong>{formatDate(selectedUser.created_at)}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Họ tên</Form.Label>
                    <Form.Control
                      value={editForm.full_name}
                      onChange={(event) => { setEditForm((current) => ({ ...current, full_name: event.target.value })); editErrors.clearError('full_name'); }}
                      isInvalid={!!editErrors.errors.full_name}
                    />
                    <Form.Control.Feedback type="invalid">{editErrors.errors.full_name}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>SĐT</Form.Label>
                    <Form.Control
                      value={editForm.phone}
                      onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Role</Form.Label>
                    <Form.Select
                      value={editForm.role}
                      onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
                    >
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex align-items-end">
                  <Form.Check
                    checked={editForm.is_active}
                    onChange={(event) => setEditForm((current) => ({ ...current, is_active: event.target.checked }))}
                    label="Tài khoản đang hoạt động"
                  />
                </Col>
              </Row>
              {updateMutation.error ? <Alert variant="danger" className="mt-3">{updateMutation.error.message}</Alert> : null}
            </Modal.Body>
            <Modal.Footer className="justify-content-between">
              <Button
                variant="outline-danger"
                disabled={resetMutation.isPending}
                onClick={() => requestPasswordReset(selectedUser)}
              >
                <KeyRound size={16} aria-hidden="true" />
                Reset password
              </Button>
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" onClick={closeEdit}>Đóng</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save size={16} aria-hidden="true" />
                  Lưu thay đổi
                </Button>
              </div>
            </Modal.Footer>
          </Form>
        ) : null}
      </Modal>

      <Modal show={Boolean(confirmAction)} onHide={() => setConfirmAction(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{confirmAction?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{confirmAction?.description}</p>
          {(updateMutation.error || resetMutation.error) ? (
            <Alert variant="danger" className="mt-3">
              {(updateMutation.error || resetMutation.error).message}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmAction(null)}>Không</Button>
          <Button
            variant={confirmAction?.type === 'reset-password' ? 'danger' : 'primary'}
            disabled={updateMutation.isPending || resetMutation.isPending}
            onClick={confirmSubmit}
          >
            Chắc chắn
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
