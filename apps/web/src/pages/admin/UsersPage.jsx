import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Save } from 'lucide-react';
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  });

  const resetMutation = useMutation({
    mutationFn: resetUserPassword
  });

  if (query.isLoading) return <LoadingState label="Đang tải nhân viên..." />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const users = query.data?.data?.users || [];

  function submitCreate(event) {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      password: form.password || undefined
    });
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Nhân viên</h1>
          <p>Quản lý profile nội bộ, role và trạng thái tài khoản.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="button-nowrap">
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
                  <tr key={user.id}>
                    <td>
                      <Form.Control
                        size="sm"
                        defaultValue={user.full_name}
                        onBlur={(event) => {
                          if (event.target.value !== user.full_name) {
                            updateMutation.mutate({ id: user.id, payload: { full_name: event.target.value } });
                          }
                        }}
                      />
                    </td>
                    <td className="small">{user.email || user.id}</td>
                    <td>
                      <Form.Control
                        size="sm"
                        defaultValue={user.phone || ''}
                        onBlur={(event) => {
                          if (event.target.value !== (user.phone || '')) {
                            updateMutation.mutate({ id: user.id, payload: { phone: event.target.value } });
                          }
                        }}
                      />
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        defaultValue={user.role}
                        onChange={(event) => updateMutation.mutate({ id: user.id, payload: { role: event.target.value } })}
                      >
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                      </Form.Select>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant={user.is_active ? 'outline-success' : 'outline-secondary'}
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: user.id, payload: { is_active: !user.is_active } })}
                      >
                        {user.is_active ? <Badge bg="success">active</Badge> : <Badge bg="secondary">disabled</Badge>}
                      </Button>
                    </td>
                    <td>{formatDate(user.created_at)}</td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={resetMutation.isPending}
                        onClick={() => resetMutation.mutate(user.id)}
                      >
                        <KeyRound size={15} aria-hidden="true" />
                        Reset
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
                  <Form.Control value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
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
            <Button type="submit" disabled={createMutation.isPending || !form.email || !form.full_name}>
              <Save size={16} aria-hidden="true" />
              Lưu
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
