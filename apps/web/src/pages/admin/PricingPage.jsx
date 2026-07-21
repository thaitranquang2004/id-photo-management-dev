import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import {
  createOnlineFilePricing,
  createPricing,
  listCardTypes,
  listOnlineFilePricing,
  listPricing
} from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatCurrency, formatDate, formatDateOnly } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

const today = new Date().toISOString().slice(0, 10);

function startOfDay(value) {
  if (!value) return null;

  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? new Date(`${value.slice(0, 10)}T00:00:00`)
    : new Date(value);

  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isPricingEffectiveToday(item) {
  const currentDay = startOfDay(new Date());
  const effectiveFrom = startOfDay(item.hieu_luc_tu);
  const effectiveUntil = startOfDay(item.hieu_luc_den);

  return effectiveFrom <= currentDay && (effectiveUntil === null || effectiveUntil >= currentDay);
}

function orderPricing(pricing, currentPricingId) {
  return [...pricing].sort((first, second) => {
    const firstIsCurrent = first.id === currentPricingId || isPricingEffectiveToday(first);
    const secondIsCurrent = second.id === currentPricingId || isPricingEffectiveToday(second);

    if (firstIsCurrent !== secondIsCurrent) return firstIsCurrent ? -1 : 1;

    const effectiveFromDifference = startOfDay(second.hieu_luc_tu) - startOfDay(first.hieu_luc_tu);
    if (effectiveFromDifference !== 0) return effectiveFromDifference;

    return new Date(second.created_at || second.ngay_tao || 0) - new Date(first.created_at || first.ngay_tao || 0);
  });
}

export default function PricingPage() {
  const queryClient = useQueryClient();
  const [cardTypeId, setCardTypeId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showOnlineFileModal, setShowOnlineFileModal] = useState(false);
  const [form, setForm] = useState({
    loai_the_id: '',
    gia_moi_ban: '',
    phi_xu_ly: 0,
    hieu_luc_tu: today,
    hieu_luc_den: ''
  });
  const [onlineFileForm, setOnlineFileForm] = useState({
    gia_tron_goi: '',
    hieu_luc_tu: today,
    hieu_luc_den: ''
  });
  const { errors, setErrors, clearError, validate } = useFormErrors();
  const {
    errors: onlineFileErrors,
    setErrors: setOnlineFileErrors,
    clearError: clearOnlineFileError,
    validate: validateOnlineFile
  } = useFormErrors();

  const cardTypesQuery = useQuery({ queryKey: ['card-types'], queryFn: listCardTypes });
  const pricingQuery = useQuery({
    queryKey: ['pricing', cardTypeId],
    queryFn: () => listPricing(cardTypeId ? { loai_the_id: cardTypeId } : {})
  });
  const onlineFilePricingQuery = useQuery({
    queryKey: ['pricing', 'online-file'],
    queryFn: listOnlineFilePricing
  });

  const createMutation = useMutation({
    mutationFn: createPricing,
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      queryClient.invalidateQueries({ queryKey: ['card-types'] });
    }
  });
  const createOnlineFileMutation = useMutation({
    mutationFn: createOnlineFilePricing,
    onSuccess: () => {
      setShowOnlineFileModal(false);
      setOnlineFileForm({ gia_tron_goi: '', hieu_luc_tu: today, hieu_luc_den: '' });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'online-file'] });
      queryClient.invalidateQueries({ queryKey: ['card-types'] });
    }
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const pricing = pricingQuery.data?.pricing || [];
  const onlineFilePricing = onlineFilePricingQuery.data?.pricing || [];
  const currentOnlineFilePricing = onlineFilePricingQuery.data?.current_pricing || null;
  const onlineFilePricingSchemaReady = onlineFilePricingQuery.data?.pricing_schema_ready !== false;
  const cardTypeMap = useMemo(() => new Map(cardTypes.map((item) => [item.id, item])), [cardTypes]);
  const orderedPricing = useMemo(() => orderPricing(pricing), [pricing]);
  const orderedOnlineFilePricing = useMemo(
    () => orderPricing(onlineFilePricing, currentOnlineFilePricing?.id),
    [onlineFilePricing, currentOnlineFilePricing?.id]
  );

  if (cardTypesQuery.isLoading || pricingQuery.isLoading || onlineFilePricingQuery.isLoading) return <LoadingState label="Đang tải bảng giá..." />;
  if (cardTypesQuery.error) return <ErrorState error={cardTypesQuery.error} onRetry={cardTypesQuery.refetch} />;
  if (pricingQuery.error) return <ErrorState error={pricingQuery.error} onRetry={pricingQuery.refetch} />;
  if (onlineFilePricingQuery.error) return <ErrorState error={onlineFilePricingQuery.error} onRetry={onlineFilePricingQuery.refetch} />;

  function openModal() {
    setForm((current) => ({ ...current, loai_the_id: cardTypeId || cardTypes[0]?.id || '' }));
    setErrors({});
    setShowModal(true);
  }

  function openOnlineFileModal() {
    setOnlineFileForm({ gia_tron_goi: '', hieu_luc_tu: today, hieu_luc_den: '' });
    setOnlineFileErrors({});
    setShowOnlineFileModal(true);
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

  function submitOnlineFilePricing(event) {
    event.preventDefault();
    if (!validateOnlineFile(onlineFileForm, {
      gia_tron_goi: 'Vui lòng nhập giá trọn gói',
      hieu_luc_tu: 'Vui lòng chọn ngày áp dụng'
    })) return;
    createOnlineFileMutation.mutate({
      gia_tron_goi: Number(onlineFileForm.gia_tron_goi),
      hieu_luc_tu: onlineFileForm.hieu_luc_tu,
      hieu_luc_den: onlineFileForm.hieu_luc_den || undefined
    });
  }

  function onlineFileCreator(item) {
    if (item.nguoi_tao_ten) return item.nguoi_tao_ten;
    if (item.created_by_name) return item.created_by_name;
    if (item.nguoi_tao && typeof item.nguoi_tao === 'object') {
      return item.nguoi_tao.ho_ten || item.nguoi_tao.email || item.nguoi_tao.id || '-';
    }
    return item.nguoi_tao || '-';
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Bảng giá</h1>
          <p>Giá mới áp dụng từ ngày hiệu lực; đơn cũ vẫn giữ snapshot giá cũ.</p>
        </div>
      </div>

      <Row className="g-4 align-items-start">
        <Col xl={7}>
          <section className="app-panel">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 mb-1">Giá loại thẻ</h2>
                <p className="text-muted mb-0">Quản lý giá in theo từng loại thẻ.</p>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Form.Select
                  value={cardTypeId}
                  onChange={(event) => setCardTypeId(event.target.value)}
                  style={{ width: 220, flexShrink: 0 }}
                  aria-label="Lọc theo loại thẻ"
                >
                  <option value="">Tất cả loại thẻ</option>
                  {cardTypes.map((cardType) => <option key={cardType.id} value={cardType.id}>{cardType.ten}</option>)}
                </Form.Select>
                <Button onClick={openModal} className="button-nowrap" disabled={cardTypes.length === 0}>
                  <Plus size={17} aria-hidden="true" />
                  Thêm giá loại thẻ
                </Button>
              </div>
            </div>

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
                    {orderedPricing.map((item) => (
                      <tr key={item.id}>
                        <td>{item.ten_loai_the || cardTypeMap.get(item.loai_the_id)?.ten || item.loai_the_id}</td>
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
        </Col>

        <Col xl={5}>
          <section className="app-panel">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 mb-1">Giá file trực tuyến</h2>
                <p className="text-muted mb-0">Áp dụng cho mỗi đơn chỉ lấy file trực tuyến.</p>
              </div>
              <Button onClick={openOnlineFileModal} className="button-nowrap" disabled={!onlineFilePricingSchemaReady}>
                <Plus size={17} aria-hidden="true" />
                Cập nhật giá file
              </Button>
            </div>

            {!onlineFilePricingSchemaReady ? (
              <Alert variant="warning">
                Database chưa có cấu trúc giá file trực tuyến. Hãy chạy migration trước khi cấu hình giá.
              </Alert>
            ) : null}

            <div className="border rounded-3 bg-light p-3 mb-4">
              <div className="small text-uppercase fw-semibold text-muted mb-1">Mức giá đang áp dụng</div>
              {currentOnlineFilePricing ? (
                <div className="d-flex flex-wrap align-items-baseline gap-2">
                  <strong className="fs-4">{formatCurrency(currentOnlineFilePricing.gia_tron_goi)}</strong>
                  <span className="text-muted small">Từ {formatDateOnly(currentOnlineFilePricing.hieu_luc_tu)}</span>
                </div>
              ) : (
                <div>
                  <strong>Chưa cấu hình giá file trực tuyến</strong>
                  <span className="d-block text-muted small mt-1">Khách và nhân viên sẽ chưa thể tạo đơn lấy file trực tuyến.</span>
                </div>
              )}
            </div>

            {onlineFilePricing.length === 0 ? (
              <EmptyState title="Chưa có lịch sử giá file trực tuyến" />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Giá trọn gói</th>
                      <th>Hiệu lực từ</th>
                      <th>Hiệu lực đến</th>
                      <th>Người tạo</th>
                      <th>Thời điểm tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedOnlineFilePricing.map((item) => (
                      <tr key={item.id}>
                        <td>{formatCurrency(item.gia_tron_goi)}</td>
                        <td>{formatDateOnly(item.hieu_luc_tu)}</td>
                        <td>{item.hieu_luc_den ? formatDateOnly(item.hieu_luc_den) : 'Đang áp dụng'}</td>
                        <td>{onlineFileCreator(item)}</td>
                        <td>{formatDate(item.created_at || item.ngay_tao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        </Col>
      </Row>

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

      <Modal show={showOnlineFileModal} onHide={() => setShowOnlineFileModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cập nhật giá file trực tuyến</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submitOnlineFilePricing}>
          <Modal.Body>
            <p className="text-muted small mb-3">Giá này được tính một lần cho mỗi đơn chỉ lấy file trực tuyến, không nhân theo số lượng ảnh.</p>
            <Form.Group className="mb-3">
              <Form.Label>Giá trọn gói</Form.Label>
              <Form.Control
                type="number"
                min="0"
                value={onlineFileForm.gia_tron_goi}
                onChange={(event) => {
                  setOnlineFileForm((current) => ({ ...current, gia_tron_goi: event.target.value }));
                  clearOnlineFileError('gia_tron_goi');
                }}
                isInvalid={!!onlineFileErrors.gia_tron_goi}
              />
              <Form.Control.Feedback type="invalid">{onlineFileErrors.gia_tron_goi}</Form.Control.Feedback>
            </Form.Group>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Áp dụng từ</Form.Label>
                  <Form.Control
                    type="date"
                    value={onlineFileForm.hieu_luc_tu}
                    onChange={(event) => {
                      setOnlineFileForm((current) => ({ ...current, hieu_luc_tu: event.target.value }));
                      clearOnlineFileError('hieu_luc_tu');
                    }}
                    isInvalid={!!onlineFileErrors.hieu_luc_tu}
                  />
                  <Form.Control.Feedback type="invalid">{onlineFileErrors.hieu_luc_tu}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Áp dụng đến <span className="text-muted fw-normal">(tuỳ chọn)</span></Form.Label>
                  <Form.Control
                    type="date"
                    value={onlineFileForm.hieu_luc_den}
                    onChange={(event) => setOnlineFileForm((current) => ({ ...current, hieu_luc_den: event.target.value }))}
                  />
                </Form.Group>
              </Col>
            </Row>
            {createOnlineFileMutation.error ? <Alert variant="danger" className="mt-3">{createOnlineFileMutation.error.message}</Alert> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowOnlineFileModal(false)}>Đóng</Button>
            <Button type="submit" disabled={createOnlineFileMutation.isPending}>Lưu giá</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
