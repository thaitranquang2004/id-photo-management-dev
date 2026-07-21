import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Download, Hash, Images, Phone, Printer, Search, Send, TicketCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Form, Image, Row, Tab, Tabs } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import {
  createPublicReprintRequest,
  getPublicPhotoDownloadUrl,
  lookupCustomer
} from '../../api/public';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import PaginationBar from '../../components/common/Pagination.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import PublicTopbar from '../../components/layout/PublicTopbar.jsx';
import { formatDateOnly } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { useToast } from '../../hooks/useToast.jsx';
import { vietnamesePhoneRule } from '../../utils/validation.js';

const COLLECTION_PAGE_SIZE = 4;
const PHOTOS_PAGE_SIZE = 4;

export default function PublicLookupPage() {
  const [searchParams] = useSearchParams();
  const autoLookupDone = useRef(false);
  const [lookupForm, setLookupForm] = useState({ so_dien_thoai: '', ma_don: '' });
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photosPage, setPhotosPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [activeTab, setActiveTab] = useState('photos');
  const [reprintForm, setReprintForm] = useState({ so_luong: 1, ly_do: '', ghi_chu: '' });
  const { errors, clearError, validate } = useFormErrors();
  const [reprintError, setReprintError] = useState('');
  const toast = useToast();
  const lookupPayload = useMemo(() => (
    { so_dien_thoai: lookupForm.so_dien_thoai.trim(), ma_don: lookupForm.ma_don.trim() }
  ), [lookupForm]);

  const lookupMutation = useMutation({
    mutationFn: lookupCustomer,
    onSuccess: () => {
      setSelectedPhotos([]);
      setReprintForm({ so_luong: 1, ly_do: '', ghi_chu: '' });
      setPhotosPage(1);
      setCollectionPage(1);
      setActiveTab('photos');
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
      danh_sach_anh_id: selectedPhotos,
      so_luong: Number(reprintForm.so_luong),
      ly_do: reprintForm.ly_do || undefined,
      ghi_chu: reprintForm.ghi_chu || undefined
    }),
    onSuccess: () => toast.success('Đã gửi yêu cầu in lại')
  });

  const result = lookupMutation.data;
  const hasResult = Boolean(result);
  const photos = result?.photos || [];
  const orderInfo = result?.order_info;
  const collection = result?.collection || [];
  const photosPages = Math.ceil(photos.length / PHOTOS_PAGE_SIZE);
  const pagedPhotos = photos.slice((photosPage - 1) * PHOTOS_PAGE_SIZE, photosPage * PHOTOS_PAGE_SIZE);
  const collectionPages = Math.ceil(collection.length / COLLECTION_PAGE_SIZE);
  const pagedCollection = collection.slice((collectionPage - 1) * COLLECTION_PAGE_SIZE, collectionPage * COLLECTION_PAGE_SIZE);

  // Khi mở link /tra-cuu?sdt=...&ma_don=... (từ email) thì tự điền và tra luôn.
  // Defer + cleanup để tránh StrictMode (dev) mount/unmount 2 lần làm kẹt mutation.
  useEffect(() => {
    const so_dien_thoai = (searchParams.get('sdt') || '').trim();
    const ma_don = (searchParams.get('ma_don') || '').trim();
    if (!so_dien_thoai || !ma_don || autoLookupDone.current) return undefined;
    const timer = setTimeout(() => {
      autoLookupDone.current = true;
      setLookupForm({ so_dien_thoai, ma_don });
      lookupMutation.mutate({ so_dien_thoai, ma_don });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function submitLookup(event) {
    event.preventDefault();
    const rules = {
      so_dien_thoai: vietnamesePhoneRule,
      ma_don: 'Vui lòng nhập mã đơn'
    };
    if (!validate(lookupForm, rules)) return;
    lookupMutation.mutate(lookupPayload);
  }

  function submitReprint() {
    if (selectedPhotos.length === 0) {
      setReprintError('Vui lòng chọn ít nhất 1 ảnh để in lại.');
      return;
    }
    setReprintError('');
    reprintMutation.mutate();
  }

  function togglePhoto(photoId) {
    setReprintError('');
    setSelectedPhotos((current) => current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : [...current, photoId]);
  }

  return (
    <div className="public-page">
      <Container>
        <PublicTopbar />

        <Row className={`g-4 ${hasResult ? 'align-items-start' : 'align-items-stretch'}`}>
          <Col lg={5}>
            <section className="app-panel public-panel">
              <div className="public-heading">
                <span className="lookup-badge">Khách hàng</span>
                <h1>Tra cứu đơn hình thẻ</h1>
                <p>Nhập số điện thoại và mã đơn để tra cứu. File chỉ tải với đơn lấy file trực tuyến đã giao và thanh toán đủ.</p>
              </div>

              <Form onSubmit={submitLookup}>
                <Form.Group className="mb-3" controlId="lookup-so_dien_thoai">
                  <Form.Label>Số điện thoại</Form.Label>
                  <Form.Control
                    value={lookupForm.so_dien_thoai}
                    onChange={(event) => { setLookupForm((current) => ({ ...current, so_dien_thoai: event.target.value })); clearError('so_dien_thoai'); }}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Ví dụ: 0901234567"
                    isInvalid={!!errors.so_dien_thoai}
                  />
                  <Form.Control.Feedback type="invalid">{errors.so_dien_thoai}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="lookup-order-code">
                  <Form.Label>Mã đơn</Form.Label>
                  <Form.Control
                    value={lookupForm.ma_don}
                    onChange={(event) => { setLookupForm((current) => ({ ...current, ma_don: event.target.value })); clearError('ma_don'); }}
                    placeholder="Ví dụ: IN-T72026-001"
                    isInvalid={!!errors.ma_don}
                  />
                  <Form.Control.Feedback type="invalid">{errors.ma_don}</Form.Control.Feedback>
                </Form.Group>
                <div className="lookup-form-actions">
                  <Button
                    type="submit"
                    disabled={lookupMutation.isPending}
                  >
                    <Search size={17} aria-hidden="true" />
                    {lookupMutation.isPending ? 'Đang tra cứu...' : 'Tra cứu'}
                  </Button>
                </div>
              </Form>
              {lookupMutation.isPending ? <LoadingState label="Đang tra cứu..." /> : null}
              {lookupMutation.error ? (
                <Alert variant="warning" className="mt-3">
                  Không tìm thấy đơn phù hợp. Vui lòng kiểm tra lại thông tin hoặc liên hệ cửa hàng.
                </Alert>
              ) : null}

              <div className="lookup-tips" aria-label="Quy trình tra cứu">
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Phone size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>1. Nhập thông tin</strong>
                    <span>Số điện thoại + mã đơn hoặc mã tra cứu.</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><CheckCircle2 size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>2. Xem ảnh duyệt</strong>
                    <span>Chỉ ảnh đã duyệt mới hiện ở trang này.</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><TicketCheck size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>3. Tải hoặc in lại</strong>
                    <span>Link tải có thời hạn và có thể lấy lại.</span>
                  </div>
                </div>
              </div>
            </section>
          </Col>

          <Col lg={7} className={hasResult ? undefined : 'd-flex'}>
            <section className={`app-panel public-panel${hasResult ? '' : ' flex-grow-1'}`}>
              {!result ? (
                <EmptyState title="Chưa có kết quả" description="Thông tin đơn và ảnh đã duyệt sẽ hiển thị sau khi tra cứu đúng." />
              ) : (
                <div className="public-result">
                  <div className="public-order-header">
                    <div>
                      <span className="text-muted d-block mb-1" style={{ fontSize: '0.8rem' }}>Mã đơn</span>
                      <h2 className="d-flex align-items-center gap-2 m-0" style={{ fontSize: '1.45rem' }}>
                        <Hash size={20} className="text-primary" aria-hidden="true" />
                        <span>{orderInfo.ma_don}</span>
                      </h2>
                    </div>
                    <OrderStatusBadge status={orderInfo.trang_thai} />
                  </div>
                  <Row className="g-3">
                    <Col sm={6}>
                      <div className="summary-box">
                        <span>Ngày chụp</span>
                        <strong>{formatDateOnly(orderInfo.ngay_tao)}</strong>
                      </div>
                    </Col>
                    <Col sm={6}>
                      <div className="summary-box">
                        <span>Loại thẻ</span>
                        <strong>{orderInfo.ten_loai_the || 'Theo đơn hàng'}</strong>
                      </div>
                    </Col>
                  </Row>

                  <Tabs
                    activeKey={activeTab}
                    onSelect={(key) => setActiveTab(key || 'photos')}
                    className="work-tabs public-lookup-tabs mt-1"
                  >
                    <Tab eventKey="photos" title="Ảnh đã duyệt">
                      {photos.length === 0 ? (
                        <EmptyState title="Chưa có ảnh đã duyệt" description="Cửa hàng sẽ cập nhật ảnh sau khi duyệt." />
                      ) : (
                        <>
                          <div className="public-photo-row">
                            {pagedPhotos.map((photo) => (
                              <div className="public-photo" key={photo.id}>
                                {photo.da_don_dep ? (
                                  <div className="photo-placeholder">Ảnh đã hết hạn lưu trữ (quá 6 tháng)</div>
                                ) : photo.signed_url ? (
                                  <Image src={photo.signed_url} alt="Ảnh đã duyệt" fluid />
                                ) : (
                                  <div className="photo-placeholder">Không thể xem trước ảnh này</div>
                                )}
                                <div className="public-photo-actions public-photo-download-action">
                                    {orderInfo?.co_the_tai_file ? <Button
                                      size="sm"
                                      variant="outline-primary"
                                    disabled={photo.da_don_dep || (downloadMutation.isPending && downloadMutation.variables === photo.id)}
                                    onClick={() => downloadMutation.mutate(photo.id)}
                                    >
                                      <Download size={15} aria-hidden="true" />
                                      {downloadMutation.isPending && downloadMutation.variables === photo.id ? 'Đang lấy link' : 'Tải'}
                                    </Button> : <span className="text-muted small">Cần hoàn tất và thanh toán đủ để tải file</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                          <PaginationBar page={photosPage} totalPages={photosPages} onChange={setPhotosPage} />
                        </>
                      )}
                    </Tab>

                    <Tab
                      eventKey="reprint"
                      title={<span className="d-inline-flex align-items-center gap-1"><Printer size={15} aria-hidden="true" /> In lại</span>}
                    >
                      <div className="reprint-box">
                        
                        {photos.length === 0 ? (
                          <EmptyState title="Chưa có ảnh để in lại" description="Đơn chưa có ảnh đã duyệt." />
                        ) : (
                          <div className="mb-3">
                            <div className="public-photo-row">
                              {pagedPhotos.map((photo) => (
                                <div
                                  className={`public-photo${selectedPhotos.includes(photo.id) ? ' selected' : ''}`}
                                  key={photo.id}
                                >
                                  {photo.da_don_dep ? (
                                    <div className="photo-placeholder">Ảnh đã hết hạn lưu trữ (quá 6 tháng)</div>
                                  ) : photo.signed_url ? (
                                    <Image src={photo.signed_url} alt="Ảnh đã duyệt" fluid />
                                  ) : (
                                    <div className="photo-placeholder">Không thể xem trước ảnh này</div>
                                  )}
                                  <div className="public-photo-actions">
                                    <Form.Check
                                      className="d-flex align-items-center gap-2 m-0"
                                      checked={selectedPhotos.includes(photo.id)}
                                      onChange={() => togglePhoto(photo.id)}
                                      label="Chọn in lại"
                                      disabled={photo.da_don_dep}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <PaginationBar page={photosPage} totalPages={photosPages} onChange={setPhotosPage} />
                          </div>
                        )}
                        <Row className="g-3">
                          <Col sm={4}>
                            <Form.Group>
                              <Form.Label>Số lượng</Form.Label>
                              <Form.Control
                                type="number"
                                min="1"
                                value={reprintForm.so_luong}
                                onChange={(event) => setReprintForm((current) => ({ ...current, so_luong: event.target.value }))}
                              />
                            </Form.Group>
                          </Col>
                          <Col sm={8}>
                            <Form.Group>
                              <Form.Label>Lý do</Form.Label>
                              <Form.Control
                                value={reprintForm.ly_do}
                                onChange={(event) => setReprintForm((current) => ({ ...current, ly_do: event.target.value }))}
                              />
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group>
                              <Form.Label>Ghi chú</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                value={reprintForm.ghi_chu}
                                onChange={(event) => setReprintForm((current) => ({ ...current, ghi_chu: event.target.value }))}
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        {reprintError ? <Alert variant="danger" className="mt-3">{reprintError}</Alert> : null}
                        {reprintMutation.error ? <Alert variant="danger" className="mt-3">{reprintMutation.error.message}</Alert> : null}
                        {reprintMutation.data ? <Alert variant="success" className="mt-3">Đã gửi yêu cầu in lại.</Alert> : null}
                        <Button
                          className="mt-3"
                          disabled={reprintMutation.isPending}
                          onClick={submitReprint}
                        >
                          <Send size={17} aria-hidden="true" />
                          {reprintMutation.isPending ? 'Đang gửi...' : `Gửi yêu cầu${selectedPhotos.length ? ` (${selectedPhotos.length})` : ''}`}
                        </Button>
                      </div>
                    </Tab>

                    {collection.length > 0 ? (
                      <Tab
                        eventKey="collection"
                        title={<span className="d-inline-flex align-items-center gap-1"><Images size={15} aria-hidden="true" /> Bộ sưu tập ({collection.length})</span>}
                      >
                        
                        <div className="public-photo-row">
                          {pagedCollection.map((photo) => (
                            <div className="public-photo" key={photo.id}>
                              {photo.da_don_dep ? (
                                <div className="photo-placeholder">Ảnh đã hết hạn lưu trữ (quá 6 tháng)</div>
                              ) : photo.signed_url ? (
                                <Image src={photo.signed_url} alt="Ảnh thẻ đã duyệt" fluid />
                              ) : (
                                <div className="photo-placeholder">Không thể xem trước ảnh này</div>
                              )}
                              <div className="public-photo-actions">
                                <span className="small text-muted">{photo.ma_don} · {formatDateOnly(photo.ngay_tao)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <PaginationBar page={collectionPage} totalPages={collectionPages} onChange={setCollectionPage} />
                      </Tab>
                    ) : null}
                  </Tabs>
                </div>
              )}
            </section>
          </Col>
        </Row>
      </Container>
      <PublicFooter />
    </div>
  );
}
