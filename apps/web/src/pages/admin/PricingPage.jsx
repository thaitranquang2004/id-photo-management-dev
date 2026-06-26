import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { createPricing, listCardTypes, listPricing } from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatCurrency, formatDateOnly } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

const today = new Date().toISOString().slice(0, 10);

export default function PricingPage() {
  const queryClient = useQueryClient();
  const [cardTypeId, setCardTypeId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    loai_the_id: '',
    gia_moi_ban: '',
    phi_xu_ly: 0,
    hieu_luc_tu: today,
    hieu_luc_den: ''
  });
  const { errors, setErrors, clearError, validate } = useFormErrors();

  const cardTypesQuery = useQuery({ queryKey: ['card-types'], queryFn: listCardTypes });
  const pricingQuery = useQuery({
    queryKey: ['pricing', cardTypeId],
    queryFn: () => listPricing(cardTypeId ? { card_type_id: cardTypeId } : {})
  });

  const createMutation = useMutation({
    mutationFn: createPricing,
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      queryClient.invalidateQueries({ queryKey: ['card-types'] });
    }
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const pricing = pricingQuery.data?.pricing || [];
  const cardTypeMap = useMemo(() => new Map(cardTypes.map((item) => [item.id, item])), [cardTypes]);

  if (cardTypesQuery.isLoading || pricingQuery.isLoading) return <LoadingState label="Đang tải bảng giá..." />;
  if (cardTypesQuery.error) return <ErrorState error={cardTypesQuery.error} onRetry={cardTypesQuery.refetch} />;
  if (pricingQuery.error) return <ErrorState error={pricingQuery.error} onRetry={pricingQuery.refetch} />;

  function openModal() {
    setForm((current) => ({ ...current, loai_the_id: cardTypeId || cardTypes[0]?.id || '' }));
    setErrors({});
    setShowModal(true);
  }

  function submit(event) {
    event.preventDefault();
    if (!validate(form, {
      loai_the_id: 'Vui lòng chọn loại thẻ',
      gia_moi_ban: 'Vui lòng nhập giá mỗi bản',
      hieu_luc_tu: 'Vui lòng chọn ngày áp dụng'
    })) return;
    createMutation.mutate({
      ...form,
      gia_moi_ban: Number(form.gia_moi_ban),
      phi_xu_ly: Number(form.phi_xu_ly || 0),
      hieu_luc_den: form.hieu_luc_den || undefined
    });
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Bảng giá</h1>
          <p>Giá mới áp dụng từ ngày hiệu lực; đơn cũ vẫn giữ snapshot giá cũ.</p>
        </div>
        <Button onClick={openModal} className="button-nowrap" disabled={cardTypes.length === 0}>
          <Plus size={17} aria-hidden="true" />
          Thêm giá
        </Button>
      </div>

      <Alert variant="info" className="app-panel">
        Khi tạo giá mới, backend sẽ đóng giá hiện hành trước đó nếu ngày hiệu lực hợp lệ. Đơn đã tạo không bị đổi giá.
      </Alert>

      <section className="app-panel">
        <Row className="g-3 align-items-end mb-3">
          <Col md={5}>
            <Form.Group>
              <Form.Label>Lọc theo loại thẻ</Form.Label>
              <Form.Select value={cardTypeId} onChange={(event) => setCardTypeId(event.target.value)}>
                <option value="">Tất cả</option>
                {cardTypes.map((cardType) => <option key={cardType.id} value={cardType.id}>{cardType.ten}</option>)}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        {pricing.length === 0 ? (
          <EmptyState title="Chưa có lịch sử giá" />
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Loại thẻ</th>
                  <th>Giá/bản</th>
                  <th>Phí xử lý</th>
                  <th>Hiệu lực từ</th>
                  <th>Hiệu lực đến</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((item) => (
                  <tr key={item.id}>
                    <td>{cardTypeMap.get(item.loai_the_id)?.ten || item.loai_the_id}</td>
                    <td>{formatCurrency(item.gia_moi_ban)}</td>
                    <td>{formatCurrency(item.phi_xu_ly)}</td>
                    <td>{formatDateOnly(item.hieu_luc_tu)}</td>
                    <td>{item.hieu_luc_den ? formatDateOnly(item.hieu_luc_den) : 'Đang áp dụng'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Thêm giá mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Loại thẻ</Form.Label>
              <Form.Select
                value={form.loai_the_id}
                onChange={(event) => { setForm((current) => ({ ...current, loai_the_id: event.target.value })); clearError('loai_the_id'); }}
                isInvalid={!!errors.loai_the_id}
              >
                <option value="">-- Chọn loại thẻ --</option>
                {cardTypes.map((cardType) => <option key={cardType.id} value={cardType.id}>{cardType.ten}</option>)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.loai_the_id}</Form.Control.Feedback>
            </Form.Group>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Giá mỗi bản</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={form.gia_moi_ban}
                    onChange={(event) => { setForm((current) => ({ ...current, gia_moi_ban: event.target.value })); clearError('gia_moi_ban'); }}
                    isInvalid={!!errors.gia_moi_ban}
                  />
                  <Form.Control.Feedback type="invalid">{errors.gia_moi_ban}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Phí xử lý</Form.Label>
                  <Form.Control type="number" min="0" value={form.phi_xu_ly} onChange={(event) => setForm((current) => ({ ...current, phi_xu_ly: event.target.value }))} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Áp dụng từ</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.hieu_luc_tu}
                    onChange={(event) => { setForm((current) => ({ ...current, hieu_luc_tu: event.target.value })); clearError('hieu_luc_tu'); }}
                    isInvalid={!!errors.hieu_luc_tu}
                  />
                  <Form.Control.Feedback type="invalid">{errors.hieu_luc_tu}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Áp dụng đến</Form.Label>
                  <Form.Control type="date" value={form.hieu_luc_den} onChange={(event) => setForm((current) => ({ ...current, hieu_luc_den: event.target.value }))} />
                </Form.Group>
              </Col>
            </Row>
            {createMutation.error ? <Alert variant="danger" className="mt-3">{createMutation.error.message}</Alert> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Đóng</Button>
            <Button type="submit" disabled={createMutation.isPending}>Lưu giá</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
