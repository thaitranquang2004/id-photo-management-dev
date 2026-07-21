import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import {
  createAdminUser,
  listAdminUsers,
  updateAdminUser
} from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatDate } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { emailRule, vietnamesePhoneRule } from '../../utils/validation.js';

const emptyForm = {
  email: '',
  password: '',
  ho_ten: '',
  so_dien_thoai: '',
  vai_tro: 'staff',
  dang_hoat_dong: true
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

  if (query.isLoading) return <LoadingState label="Đang tải nhân viên..." />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const users = query.data?.data?.users || [];

  function submitCreate(event) {
    event.preventDefault();
    if (!createErrors.validate(form, {
      ho_ten: 'Vui lòng nhập họ tên',
      email: emailRule,
      so_dien_thoai: { ...vietnamesePhoneRule, required: false }
    })) return;
    createMutation.mutate({
      ...form,
      password: form.password || undefined
    });
  }

  function openEdit(user) {
    setSelectedUser(user);
    editErrors.setErrors({});
    setEditForm({
      ho_ten: user.ho_ten || '',
      so_dien_thoai: user.so_dien_thoai || '',
      vai_tro: user.vai_tro || 'staff',
      dang_hoat_dong: Boolean(user.dang_hoat_dong)
    });
  }

  function closeEdit() {
    setSelectedUser(null);
    setEditForm(null);
  }

  function submitEdit(event) {
    event.preventDefault();
    if (!selectedUser || !editForm) return;

    if (!editErrors.validate(editForm, {
      ho_ten: 'Vui lòng nhập họ tên',
      so_dien_thoai: { ...vietnamesePhoneRule, required: false }
    })) return;

    const payload = {};
    if (editForm.ho_ten !== (selectedUser.ho_ten || '')) payload.ho_ten = editForm.ho_ten;
    if (editForm.so_dien_thoai !== (selectedUser.so_dien_thoai || '')) payload.so_dien_thoai = editForm.so_dien_thoai;
    if (editForm.vai_tro !== selectedUser.vai_tro) payload.vai_tro = editForm.vai_tro;
    if (editForm.dang_hoat_dong !== Boolean(selectedUser.dang_hoat_dong)) payload.dang_hoat_dong = editForm.dang_hoat_dong;

    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }

    setConfirmAction({
      type: 'update',
      id: selectedUser.id,
      payload,
      title: 'Xác nhận sửa nhân viên',
      description: `Bạn chắc chắn muốn cập nhật thông tin của ${selectedUser.ho_ten || selectedUser.email || selectedUser.id}?`
    });
  }

  function confirmSubmit() {
    if (!confirmAction) return;
    if (confirmAction.type === 'update') {
      updateMutation.mutate({ id: confirmAction.id, payload: confirmAction.payload });
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Nhân viên</h1>
          <p>Quản lý nội bộ, vai trò và trạng thái tài khoản.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); createErrors.setErrors({}); setShowCreate(true); }} className="button-nowrap">
          <Plus size={17} aria-hidden="true" />
          Thêm nhân viên
        </Button>
      </div>

      {updateMutation.error ? <Alert variant="danger">{updateMutation.error.message}</Alert> : null}

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
                    <td className="fw-semibold">{user.ho_ten || '-'}</td>
                    <td className="small">{user.email || user.id}</td>
                    <td>{user.so_dien_thoai || '-'}</td>
                    <td><Badge bg={user.vai_tro === 'admin' ? 'primary' : 'secondary'}>{user.vai_tro}</Badge></td>
                    <td>
                      {user.dang_hoat_dong ? <Badge bg="success">active</Badge> : <Badge bg="secondary">disabled</Badge>}
                    </td>
                    <td>{formatDate(user.ngay_tao)}</td>
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
                    value={form.ho_ten}
                    onChange={(event) => { setForm((current) => ({ ...current, ho_ten: event.target.value })); createErrors.clearError('ho_ten'); }}
                    isInvalid={!!createErrors.errors.ho_ten}
                  />
                  <Form.Control.Feedback type="invalid">{createErrors.errors.ho_ten}</Form.Control.Feedback>
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
                  <Form.Control
                    value={form.so_dien_thoai}
                    inputMode="tel"
                    placeholder="0901234567 hoặc +84901234567"
                    onChange={(event) => { setForm((current) => ({ ...current, so_dien_thoai: event.target.value })); createErrors.clearError('so_dien_thoai'); }}
                    isInvalid={!!createErrors.errors.so_dien_thoai}
                  />
                  <Form.Control.Feedback type="invalid">{createErrors.errors.so_dien_thoai}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={form.vai_tro} onChange={(event) => setForm((current) => ({ ...current, vai_tro: event.target.value }))}>
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
                  checked={form.dang_hoat_dong}
                  onChange={(event) => setForm((current) => ({ ...current, dang_hoat_dong: event.target.checked }))}
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
                    <strong>{formatDate(selectedUser.ngay_tao)}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Họ tên</Form.Label>
                    <Form.Control
                      value={editForm.ho_ten}
                      onChange={(event) => { setEditForm((current) => ({ ...current, ho_ten: event.target.value })); editErrors.clearError('ho_ten'); }}
                      isInvalid={!!editErrors.errors.ho_ten}
                    />
                    <Form.Control.Feedback type="invalid">{editErrors.errors.ho_ten}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>SĐT</Form.Label>
                    <Form.Control
                      value={editForm.so_dien_thoai}
                      inputMode="tel"
                      placeholder="0901234567 hoặc +84901234567"
                      onChange={(event) => { setEditForm((current) => ({ ...current, so_dien_thoai: event.target.value })); editErrors.clearError('so_dien_thoai'); }}
                      isInvalid={!!editErrors.errors.so_dien_thoai}
                    />
                    <Form.Control.Feedback type="invalid">{editErrors.errors.so_dien_thoai}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Role</Form.Label>
                    <Form.Select
                      value={editForm.vai_tro}
                      onChange={(event) => setEditForm((current) => ({ ...current, vai_tro: event.target.value }))}
                    >
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex align-items-end">
                  <Form.Check
                    checked={editForm.dang_hoat_dong}
                    onChange={(event) => setEditForm((current) => ({ ...current, dang_hoat_dong: event.target.checked }))}
                    label="Tài khoản đang hoạt động"
                  />
                </Col>
              </Row>
              {updateMutation.error ? <Alert variant="danger" className="mt-3">{updateMutation.error.message}</Alert> : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={closeEdit}>Đóng</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save size={16} aria-hidden="true" />
                Lưu thay đổi
              </Button>
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
          {updateMutation.error ? (
            <Alert variant="danger" className="mt-3">
              {updateMutation.error.message}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmAction(null)}>Không</Button>
          <Button
            variant="primary"
            disabled={updateMutation.isPending}
            onClick={confirmSubmit}
          >
            Chắc chắn
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
