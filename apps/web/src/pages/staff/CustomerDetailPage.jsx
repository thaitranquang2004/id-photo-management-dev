import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Col, Form, Image, Modal, Row, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { getCustomer, getCustomerPhotos, getCustomerPrintLayouts, updateCustomer } from '../../api/customers';
import { getLayoutDownloadUrl } from '../../api/layouts';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import { formatDate } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

// URL hiển thị ảnh: ưu tiên ảnh đã xử lý, fallback ảnh gốc; null nếu đã hết hạn lưu trữ.
function photoPreviewUrl(photo) {
  if (photo.ngay_don_dep) return null;
  return photo.metadata_anh_xu_ly?.secure_url || photo.metadata_anh_goc?.secure_url || null;
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', email: '', notes: '' });
  const { errors, setErrors, clearError, validate } = useFormErrors();
  const customerQuery = useQuery({
    queryKey: ['customers', id],
    queryFn: () => getCustomer(id)
  });
  const layoutsQuery = useQuery({
    queryKey: ['customers', id, 'print-layouts'],
    queryFn: () => getCustomerPrintLayouts(id, { limit: 20 })
  });
  const photosQuery = useQuery({
    queryKey: ['customers', id, 'photos'],
    queryFn: () => getCustomerPhotos(id)
  });
  const downloadMutation = useMutation({
    mutationFn: getLayoutDownloadUrl,
    onSuccess: (result) => {
      const url = result.layout_signed_url || result.signed_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
  const editMutation = useMutation({
    mutationFn: () => updateCustomer(id, {
      full_name: editForm.full_name,
      phone: editForm.phone,
      email: editForm.email || undefined,
      notes: editForm.notes || undefined
    }),
    onSuccess: () => {
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ['customers', id] });
    }
  });

  function openEdit() {
    setEditForm({
      full_name: customer?.ho_ten || '',
      phone: customer?.so_dien_thoai || '',
      email: customer?.email || '',
      notes: customer?.ghi_chu || ''
    });
    setErrors({});
    setShowEdit(true);
  }

  function handleSaveCustomer() {
    if (!validate(editForm, { full_name: 'Vui lòng nhập họ tên', phone: 'Vui lòng nhập số điện thoại' })) return;
    editMutation.mutate();
  }

  if (customerQuery.isLoading || layoutsQuery.isLoading) return <LoadingState label="Đang tải lịch sử khách..." />;
  if (customerQuery.error) return <ErrorState error={customerQuery.error} onRetry={customerQuery.refetch} />;
  if (layoutsQuery.error) return <ErrorState error={layoutsQuery.error} onRetry={layoutsQuery.refetch} />;

  const customer = customerQuery.data?.customer;
  const recentOrders = customerQuery.data?.recent_orders || [];
  const printLayouts = layoutsQuery.data?.data?.print_layouts || [];
  const collectionPhotos = photosQuery.data?.photos || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>{customer?.ho_ten}</h1>
          <p>{customer?.so_dien_thoai} · {customer?.email || 'Chưa có email'}</p>
        </div>
        <div className="header-actions">
          <Button variant="outline-primary" onClick={openEdit}>Sửa thông tin</Button>
          <Button as={Link} to="/staff/orders/new" variant="primary">Tạo đơn mới</Button>
        </div>
      </div>

      <Row className="g-3">
        <Col lg={4}>
          <section className="app-panel">
            <h2>Thông tin khách</h2>
            <Table className="detail-table">
              <tbody>
                <tr><th>Họ tên</th><td>{customer?.ho_ten}</td></tr>
                <tr><th>SĐT</th><td>{customer?.so_dien_thoai}</td></tr>
                <tr><th>Email</th><td>{customer?.email || '-'}</td></tr>
                <tr><th>Ghi chú</th><td>{customer?.ghi_chu || '-'}</td></tr>
                <tr><th>Ngày tạo</th><td>{formatDate(customer?.ngay_tao)}</td></tr>
              </tbody>
            </Table>
          </section>
        </Col>
        <Col lg={8}>
          <section className="app-panel">
            <h2>Đơn gần đây</h2>
            {recentOrders.length === 0 ? (
              <EmptyState title="Chưa có đơn cũ" />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Loại thẻ</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="fw-semibold">{order.ma_don}</td>
                        <td>{order.ten_loai_the}</td>
                        <td><OrderStatusBadge status={order.trang_thai} /></td>
                        <td>{formatDate(order.ngay_tao)}</td>
                        <td className="text-end">
                          <Button as={Link} to={`/staff/orders/${order.id}`} size="sm" variant="outline-primary">
                            Mở đơn
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        </Col>
      </Row>

      <section className="app-panel">
        <h2>Bộ sưu tập ảnh thẻ</h2>
        {photosQuery.isLoading ? (
          <LoadingState label="Đang tải ảnh..." />
        ) : collectionPhotos.length === 0 ? (
          <EmptyState title="Chưa có ảnh đã duyệt" description="Ảnh thẻ đã duyệt của khách qua các đơn sẽ hiển thị tại đây." />
        ) : (
          <div className="public-photo-grid">
            {collectionPhotos.map((photo) => {
              const url = photoPreviewUrl(photo);
              return (
                <div className="public-photo" key={photo.id}>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <Image src={url} alt="Ảnh đã duyệt" fluid />
                    </a>
                  ) : (
                    <div className="photo-placeholder">Ảnh đã hết hạn lưu trữ</div>
                  )}
                  <div className="public-photo-actions">
                    <span className="small text-muted">{photo.ma_don} · {formatDate(photo.ngay_tao)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="app-panel">
        <h2>Layout cũ</h2>
        {printLayouts.length === 0 ? (
          <EmptyState title="Chưa có layout cũ" description="Layout generated của khách sẽ hiển thị tại đây." />
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Loại layout</th>
                  <th>Khổ giấy</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="text-end">Tải lại</th>
                </tr>
              </thead>
              <tbody>
                {printLayouts.map((layout) => (
                  <tr key={layout.id}>
                    <td>{layout.don_hang_id}</td>
                    <td>{layout.kieu_bo_cuc}</td>
                    <td>{layout.kho_giay}</td>
                    <td>{layout.trang_thai}</td>
                    <td>{formatDate(layout.ngay_tao)}</td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={downloadMutation.isPending || layout.trang_thai !== 'generated'}
                        onClick={() => downloadMutation.mutate(layout.id)}
                      >
                        Tải signed URL
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <Modal show={showEdit} onHide={() => setShowEdit(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Sửa thông tin khách</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Họ tên *</Form.Label>
            <Form.Control
              value={editForm.full_name}
              onChange={(e) => { setEditForm((c) => ({ ...c, full_name: e.target.value })); clearError('full_name'); }}
              isInvalid={!!errors.full_name}
            />
            <Form.Control.Feedback type="invalid">{errors.full_name}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Số điện thoại *</Form.Label>
            <Form.Control
              value={editForm.phone}
              onChange={(e) => { setEditForm((c) => ({ ...c, phone: e.target.value })); clearError('phone'); }}
              inputMode="tel"
              isInvalid={!!errors.phone}
            />
            <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={editForm.email} onChange={(e) => setEditForm((c) => ({ ...c, email: e.target.value }))} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Ghi chú</Form.Label>
            <Form.Control as="textarea" rows={2} value={editForm.notes} onChange={(e) => setEditForm((c) => ({ ...c, notes: e.target.value }))} />
          </Form.Group>
          {editMutation.error ? <Alert variant="danger" className="mt-3">{editMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowEdit(false)}>Đóng</Button>
          <Button
            disabled={editMutation.isPending}
            onClick={handleSaveCustomer}
          >
            {editMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
