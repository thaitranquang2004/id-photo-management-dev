import { useMutation } from '@tanstack/react-query';
import { Download, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Col, Container, Form, Image, Row } from 'react-bootstrap';
import {
  createPublicReprintRequest,
  getPublicPhotoDownloadUrl,
  lookupCustomer
} from '../../api/public';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import { formatDateOnly } from '../../utils/format';

export default function PublicLookupPage() {
  const [lookupForm, setLookupForm] = useState({ phone: '', order_code: '', token: '' });
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [reprintForm, setReprintForm] = useState({ quantity: 1, reason: '', note: '' });
  const lookupPayload = useMemo(() => (
    lookupForm.token.trim()
      ? { token: lookupForm.token.trim() }
      : { phone: lookupForm.phone.trim(), order_code: lookupForm.order_code.trim() }
  ), [lookupForm]);

  const lookupMutation = useMutation({
    mutationFn: lookupCustomer,
    onSuccess: () => {
      setSelectedPhotos([]);
      setReprintForm({ quantity: 1, reason: '', note: '' });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: (photoId) => getPublicPhotoDownloadUrl(photoId, lookupPayload),
    onSuccess: (result) => {
      if (result.signed_url) window.open(result.signed_url, '_blank', 'noopener,noreferrer');
    }
  });

  const reprintMutation = useMutation({
    mutationFn: () => createPublicReprintRequest({
      ...lookupPayload,
      photo_ids: selectedPhotos,
      quantity: Number(reprintForm.quantity),
      reason: reprintForm.reason || undefined,
      note: reprintForm.note || undefined
    })
  });

  const result = lookupMutation.data;
  const photos = result?.photos || [];
  const orderInfo = result?.order_info;

  function submitLookup(event) {
    event.preventDefault();
    lookupMutation.mutate(lookupPayload);
  }

  function togglePhoto(photoId) {
    setSelectedPhotos((current) => current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : [...current, photoId]);
  }

  return (
    <div className="public-page">
      <Container>
        <div className="public-topbar">
          <div className="brand-mark">
            <span className="brand-dot" />
            <span>Tiệm hình thẻ</span>
          </div>
          <a href="/login">Staff/Admin</a>
        </div>

        <Row className="g-4">
          <Col lg={5}>
            <section className="app-panel public-panel">
              <h1>Tra cứu đơn</h1>
              <p className="text-muted">Nhập số điện thoại và mã đơn, hoặc dùng mã tra cứu nếu cửa hàng đã gửi.</p>
              <Form onSubmit={submitLookup}>
                <Form.Group className="mb-3">
                  <Form.Label>Số điện thoại</Form.Label>
                  <Form.Control
                    value={lookupForm.phone}
                    onChange={(event) => setLookupForm((current) => ({ ...current, phone: event.target.value }))}
                    inputMode="tel"
                    disabled={Boolean(lookupForm.token)}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Mã đơn</Form.Label>
                  <Form.Control
                    value={lookupForm.order_code}
                    onChange={(event) => setLookupForm((current) => ({ ...current, order_code: event.target.value }))}
                    disabled={Boolean(lookupForm.token)}
                  />
                </Form.Group>
                <div className="public-divider">hoặc</div>
                <Form.Group className="mb-3">
                  <Form.Label>Mã tra cứu</Form.Label>
                  <Form.Control
                    value={lookupForm.token}
                    onChange={(event) => setLookupForm((current) => ({ ...current, token: event.target.value }))}
                  />
                </Form.Group>
                <Button
                  type="submit"
                  className="w-100"
                  disabled={lookupMutation.isPending || (!lookupForm.token && (!lookupForm.phone || !lookupForm.order_code))}
                >
                  <Search size={17} aria-hidden="true" />
                  Tra cứu
                </Button>
              </Form>
              {lookupMutation.isPending ? <LoadingState label="Đang tra cứu..." /> : null}
              {lookupMutation.error ? (
                <Alert variant="warning" className="mt-3">
                  Không tìm thấy đơn phù hợp. Vui lòng kiểm tra lại thông tin hoặc liên hệ cửa hàng.
                </Alert>
              ) : null}
            </section>
          </Col>

          <Col lg={7}>
            <section className="app-panel public-panel">
              {!result ? (
                <EmptyState title="Chưa có kết quả" description="Thông tin đơn và ảnh đã duyệt sẽ hiển thị sau khi tra cứu đúng." />
              ) : (
                <div className="public-result">
                  <div className="public-order-header">
                    <div>
                      <span className="text-muted">Mã đơn</span>
                      <h2>{orderInfo.order_code}</h2>
                    </div>
                    <OrderStatusBadge status={orderInfo.status} />
                  </div>
                  <Row className="g-3">
                    <Col sm={6}>
                      <div className="summary-box">
                        <span>Ngày chụp</span>
                        <strong>{formatDateOnly(orderInfo.created_at)}</strong>
                      </div>
                    </Col>
                    <Col sm={6}>
                      <div className="summary-box">
                        <span>Loại thẻ</span>
                        <strong>{orderInfo.card_type_name || 'Theo đơn hàng'}</strong>
                      </div>
                    </Col>
                  </Row>

                  <h3>Ảnh đã duyệt</h3>
                  {photos.length === 0 ? (
                    <EmptyState title="Chưa có ảnh approved" description="Cửa hàng sẽ cập nhật ảnh sau khi duyệt." />
                  ) : (
                    <div className="public-photo-grid">
                      {photos.map((photo) => (
                        <div className="public-photo" key={photo.id}>
                          {photo.signed_url ? <Image src={photo.signed_url} alt="Ảnh đã duyệt" fluid /> : <div className="photo-placeholder">No preview</div>}
                          <div className="public-photo-actions">
                            <Form.Check
                              checked={selectedPhotos.includes(photo.id)}
                              onChange={() => togglePhoto(photo.id)}
                              label="In lại"
                            />
                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={downloadMutation.isPending}
                              onClick={() => downloadMutation.mutate(photo.id)}
                            >
                              <Download size={15} aria-hidden="true" />
                              Tải
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Alert variant="info" className="mt-3">
                    Link tải là signed URL có thời hạn. Nếu link hết hạn, hãy tra cứu lại để lấy link mới.
                  </Alert>

                  <div className="reprint-box">
                    <h3>Gửi yêu cầu in lại</h3>
                    <Row className="g-3">
                      <Col sm={4}>
                        <Form.Group>
                          <Form.Label>Số lượng</Form.Label>
                          <Form.Control
                            type="number"
                            min="1"
                            value={reprintForm.quantity}
                            onChange={(event) => setReprintForm((current) => ({ ...current, quantity: event.target.value }))}
                          />
                        </Form.Group>
                      </Col>
                      <Col sm={8}>
                        <Form.Group>
                          <Form.Label>Lý do</Form.Label>
                          <Form.Control
                            value={reprintForm.reason}
                            onChange={(event) => setReprintForm((current) => ({ ...current, reason: event.target.value }))}
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={12}>
                        <Form.Group>
                          <Form.Label>Ghi chú</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            value={reprintForm.note}
                            onChange={(event) => setReprintForm((current) => ({ ...current, note: event.target.value }))}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    {reprintMutation.error ? <Alert variant="danger" className="mt-3">{reprintMutation.error.message}</Alert> : null}
                    {reprintMutation.data ? <Alert variant="success" className="mt-3">Đã gửi yêu cầu in lại.</Alert> : null}
                    <Button
                      className="mt-3"
                      disabled={reprintMutation.isPending || selectedPhotos.length === 0}
                      onClick={() => reprintMutation.mutate()}
                    >
                      <Send size={17} aria-hidden="true" />
                      Gửi yêu cầu
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
