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
import { formatCurrency } from '../../utils/format';

const emptyForm = {
  name: '',
  short_code: '',
  width_mm: '',
  height_mm: '',
  background_color: '#FFFFFF',
  requirements: '{}',
  display_order: 0
};

function toForm(cardType) {
  if (!cardType) return emptyForm;
  return {
    name: cardType.name || '',
    short_code: cardType.short_code || '',
    width_mm: cardType.width_mm || '',
    height_mm: cardType.height_mm || '',
    background_color: cardType.background_color || '#FFFFFF',
    requirements: JSON.stringify(cardType.requirements || {}, null, 2),
    display_order: cardType.display_order || 0
  };
}

function parsePayload(form) {
  return {
    name: form.name,
    short_code: form.short_code,
    width_mm: Number(form.width_mm),
    height_mm: Number(form.height_mm),
    background_color: form.background_color,
    requirements: JSON.parse(form.requirements || '{}'),
    display_order: Number(form.display_order || 0)
  };
}

export default function CardTypesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-types'] })
  });

  function openModal(cardType = null) {
    setEditing(cardType);
    setForm(toForm(cardType));
    setFormError('');
    setShowModal(true);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
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
                    <td className="fw-semibold">{cardType.name}</td>
                    <td>{cardType.short_code}</td>
                    <td>{cardType.width_mm} x {cardType.height_mm} mm</td>
                    <td>
                      <span className="color-swatch" style={{ backgroundColor: cardType.background_color }} />
                      {cardType.background_color}
                    </td>
                    <td>{formatCurrency(Number(cardType.current_price_per_copy || 0) + Number(cardType.current_processing_fee || 0))}</td>
                    <td className="requirements-cell">{JSON.stringify(cardType.requirements || {})}</td>
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
                          onClick={() => archiveMutation.mutate(cardType.id)}
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
                  <Form.Control value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Short code</Form.Label>
                  <Form.Control value={form.short_code} onChange={(event) => setForm((current) => ({ ...current, short_code: event.target.value }))} required />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Rộng mm</Form.Label>
                  <Form.Control type="number" value={form.width_mm} onChange={(event) => setForm((current) => ({ ...current, width_mm: event.target.value }))} required />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Cao mm</Form.Label>
                  <Form.Control type="number" value={form.height_mm} onChange={(event) => setForm((current) => ({ ...current, height_mm: event.target.value }))} required />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Thứ tự</Form.Label>
                  <Form.Control type="number" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: event.target.value }))} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Màu nền</Form.Label>
                  <Form.Control type="color" value={form.background_color} onChange={(event) => setForm((current) => ({ ...current, background_color: event.target.value }))} />
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Requirements JSON</Form.Label>
                  <Form.Control as="textarea" rows={4} value={form.requirements} onChange={(event) => setForm((current) => ({ ...current, requirements: event.target.value }))} />
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
