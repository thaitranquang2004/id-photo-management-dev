import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Edit, Plus } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import {
  archiveCardType,
  createCardType,
  listCardTypes,
  updateCardType
} from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import ConfirmDialog from '../../components/feedback/ConfirmDialog.jsx';
import { formatCurrency } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

const emptyForm = {
  ten: '',
  ma_viet_tat: '',
  rong_mm: '',
  cao_mm: '',
  mau_nen: '#FFFFFF',
  yeu_cau: '{}',
  thu_tu_hien_thi: 0
};

function toForm(cardType) {
  if (!cardType) return emptyForm;
  return {
    ten: cardType.ten || '',
    ma_viet_tat: cardType.ma_viet_tat || '',
    rong_mm: cardType.rong_mm || '',
    cao_mm: cardType.cao_mm || '',
    mau_nen: cardType.mau_nen || '#FFFFFF',
    yeu_cau: JSON.stringify(cardType.yeu_cau || {}, null, 2),
    thu_tu_hien_thi: cardType.thu_tu_hien_thi || 0
  };
}

function parsePayload(form) {
  return {
    ten: form.ten,
    ma_viet_tat: form.ma_viet_tat,
    rong_mm: Number(form.rong_mm),
    cao_mm: Number(form.cao_mm),
    mau_nen: form.mau_nen,
    yeu_cau: JSON.parse(form.yeu_cau || '{}'),
    thu_tu_hien_thi: Number(form.thu_tu_hien_thi || 0)
  };
}

export default function CardTypesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const { errors, setErrors, clearError, validate } = useFormErrors();
  const query = useQuery({
    queryKey: ['card-types'],
    queryFn: listCardTypes
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => editing ? updateCardType(editing.id, payload) : createCardType(payload),
    onSuccess: () => {
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['card-types'] });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: archiveCardType,
    onSuccess: () => {
      setArchiveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['card-types'] });
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
    }
  });

  function openModal(cardType = null) {
    setEditing(cardType);
    setForm(toForm(cardType));
    setFormError('');
    setErrors({});
    setShowModal(true);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!validate(form, {
      ten: 'Vui lòng nhập tên loại thẻ',
      ma_viet_tat: 'Vui lòng nhập short code',
      rong_mm: 'Vui lòng nhập chiều rộng',
      cao_mm: 'Vui lòng nhập chiều cao'
    })) return;
    try {
      saveMutation.mutate(parsePayload(form));
    } catch (error) {
      setFormError('Requirements phải là JSON hợp lệ.');
    }
  }

  if (query.isLoading) return <LoadingState label="Đang tải loại thẻ..." />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const cardTypes = query.data?.card_types || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Giá & loại thẻ</h1>
          <p>Quản lý chuẩn kích thước, nền, yêu cầu và giá hiện hành.</p>
        </div>
        <Button onClick={() => openModal()} className="button-nowrap">
          <Plus size={17} aria-hidden="true" />
          Tạo loại thẻ
        </Button>
      </div>

      {archiveMutation.error ? <Alert variant="danger">{archiveMutation.error.message}</Alert> : null}

      <section className="app-panel">
        {cardTypes.length === 0 ? (
          <EmptyState title="Chưa có loại thẻ" description="Tạo loại thẻ trước khi staff tạo đơn mới." />
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Short code</th>
                  <th>Kích thước</th>
                  <th>Nền</th>
                  <th>Giá hiện hành</th>
                  <th>Yêu cầu</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cardTypes.map((cardType) => (
                  <tr key={cardType.id}>
                    <td className="fw-semibold">{cardType.ten}</td>
                    <td>{cardType.ma_viet_tat}</td>
                    <td>{cardType.rong_mm} x {cardType.cao_mm} mm</td>
                    <td>
                      <span className="color-swatch" style={{ backgroundColor: cardType.mau_nen }} />
                      {cardType.mau_nen}
                    </td>
                    <td>{formatCurrency(Number(cardType.gia_moi_ban_hien_hanh || 0) + Number(cardType.phi_xu_ly_hien_hanh || 0))}</td>
                    <td className="requirements-cell">{JSON.stringify(cardType.yeu_cau || {})}</td>
                    <td className="text-end">
                      <div className="table-actions justify-content-end">
                        <Button size="sm" variant="outline-primary" onClick={() => openModal(cardType)}>
                          <Edit size={15} aria-hidden="true" />
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={archiveMutation.isPending}
                          onClick={() => setArchiveTarget(cardType)}
                        >
                          <Archive size={15} aria-hidden="true" />
                          Archive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <ConfirmDialog
        show={Boolean(archiveTarget)}
        title="Archive loại thẻ?"
        message={archiveTarget ? `Bạn có chắc muốn archive “${archiveTarget.ten}”? Loại thẻ sẽ không còn dùng để tạo đơn mới. Các mức giá hiện hành sẽ được dừng hiệu lực từ hôm nay, nhưng lịch sử giá và tên loại thẻ vẫn được giữ lại.` : ''}
        confirmLabel="Archive loại thẻ"
        variant="danger"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        onCancel={() => { if (!archiveMutation.isPending) setArchiveTarget(null); }}
      />

      <Modal show={showModal} onHide={() => { setShowModal(false); setEditing(null); setForm(emptyForm); }} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Sửa loại thẻ' : 'Tạo loại thẻ'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Tên</Form.Label>
                  <Form.Control
                    value={form.ten}
                    onChange={(event) => { setForm((current) => ({ ...current, ten: event.target.value })); clearError('ten'); }}
                    isInvalid={!!errors.ten}
                  />
                  <Form.Control.Feedback type="invalid">{errors.ten}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Short code</Form.Label>
                  <Form.Control
                    value={form.ma_viet_tat}
                    onChange={(event) => { setForm((current) => ({ ...current, ma_viet_tat: event.target.value })); clearError('ma_viet_tat'); }}
                    isInvalid={!!errors.ma_viet_tat}
                  />
                  <Form.Control.Feedback type="invalid">{errors.ma_viet_tat}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Rộng mm</Form.Label>
                  <Form.Control
                    type="number"
                    value={form.rong_mm}
                    onChange={(event) => { setForm((current) => ({ ...current, rong_mm: event.target.value })); clearError('rong_mm'); }}
                    isInvalid={!!errors.rong_mm}
                  />
                  <Form.Control.Feedback type="invalid">{errors.rong_mm}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Cao mm</Form.Label>
                  <Form.Control
                    type="number"
                    value={form.cao_mm}
                    onChange={(event) => { setForm((current) => ({ ...current, cao_mm: event.target.value })); clearError('cao_mm'); }}
                    isInvalid={!!errors.cao_mm}
                  />
                  <Form.Control.Feedback type="invalid">{errors.cao_mm}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Thứ tự</Form.Label>
                  <Form.Control type="number" value={form.thu_tu_hien_thi} onChange={(event) => setForm((current) => ({ ...current, thu_tu_hien_thi: event.target.value }))} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Màu nền</Form.Label>
                  <Form.Control type="color" value={form.mau_nen} onChange={(event) => setForm((current) => ({ ...current, mau_nen: event.target.value }))} />
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Requirements JSON</Form.Label>
                  <Form.Control as="textarea" rows={4} value={form.yeu_cau} onChange={(event) => setForm((current) => ({ ...current, yeu_cau: event.target.value }))} />
                </Form.Group>
              </Col>
            </Row>
            {(formError || saveMutation.error) ? <Alert variant="danger" className="mt-3">{formError || saveMutation.error.message}</Alert> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => { setShowModal(false); setEditing(null); setForm(emptyForm); }}>Đóng</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
