import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileImage, RefreshCw, Send, ShieldCheck, Upload, WandSparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Col,
  Form,
  Image,
  InputGroup,
  Modal,
  ProgressBar,
  Row,
  Table,
  Tabs,
  Tab
} from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { getOrder, completeOrder, deliverOrder, startOrderProcessing, notifyOrderReady, cancelOrder } from '../../api/orders';
import { listNotifications } from '../../api/notifications';
import {
  approvePhoto,
  batchProcessPhotos,
  getProcessingJob,
  rejectPhoto,
  uploadPhotos,
  requalifyPhoto
} from '../../api/photos';
import { listPayments, recordPayment } from '../../api/payments';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import PhotoStatusBadge from '../../components/status/PhotoStatusBadge.jsx';
import QcStatusBadge from '../../components/status/QcStatusBadge.jsx';
import PaymentStatusBadge from '../../components/status/PaymentStatusBadge.jsx';
import LayoutComposer from '../../components/layout/LayoutComposer.jsx';
import { formatCurrency, formatDate } from '../../utils/format';

const PAYMENT_KIND_LABEL = { deposit: 'Đặt cọc', balance: 'Thanh toán', refund: 'Hoàn tiền' };

const terminalJobStatuses = new Set(['completed', 'failed', 'cancelled']);

function orderData(queryData) {
  return queryData || { order: null, pricing_snapshot: null, photos: [], print_layouts: [], appointment: null };
}

function photoPreviewUrl(photo) {
  if (photo.purged_at) return null;
  return photo.processed_asset_metadata?.secure_url
    || photo.original_asset_metadata?.secure_url
    || null;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedPreviews, setSelectedPreviews] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [lookupUrl, setLookupUrl] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ loai: 'balance', so_tien: '', hinh_thuc: 'cash', ghi_chu: '' });
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [showDeliver, setShowDeliver] = useState(false);
  const [deliverReason, setDeliverReason] = useState('');

  const orderQuery = useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id)
  });

  const { order, pricing_snapshot: pricingSnapshot, photos, appointment } = orderData(orderQuery.data);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'order', id],
    queryFn: () => listNotifications({ order_id: id, limit: 20 })
  });
  const approvedPhotos = useMemo(() => photos.filter((photo) => photo.status === 'approved'), [photos]);
  const pendingAiPhotos = useMemo(() => photos.filter((photo) => photo.status === 'raw'), [photos]);

  useEffect(() => {
    const previews = selectedFiles.map((file) => ({
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file)
    }));
    setSelectedPreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [selectedFiles]);

  const processMutation = useMutation({
    mutationFn: () => batchProcessPhotos({
      order_id: id,
      photo_ids: pendingAiPhotos.map((photo) => photo.id),
      provider: 'google_ai',
      strict_quality_check: false
    }),
    onSuccess: (result) => {
      if (result.job?.id) setActiveJobId(result.job.id);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const autoProcessMutation = useMutation({
    mutationFn: (photoIds) => batchProcessPhotos({
      order_id: id,
      photo_ids: photoIds,
      provider: 'google_ai',
      strict_quality_check: false
    }),
    onSuccess: (result) => {
      if (result.job?.id) setActiveJobId(result.job.id);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: () => uploadPhotos(id, selectedFiles),
    onSuccess: (result) => {
      const uploadedPhotos = result.photos || [];
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      if (uploadedPhotos.length > 0) {
        autoProcessMutation.mutate(uploadedPhotos.map((photo) => photo.id));
      }
    }
  });

  const jobQuery = useQuery({
    queryKey: ['processing-jobs', activeJobId],
    queryFn: () => getProcessingJob(activeJobId),
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      return status && !terminalJobStatuses.has(status) ? 1500 : false;
    }
  });

  useEffect(() => {
    const status = jobQuery.data?.job?.status;
    if (status && terminalJobStatuses.has(status)) {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  }, [id, jobQuery.data?.job?.status, queryClient]);

  const approveMutation = useMutation({
    mutationFn: (photoId) => approvePhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const rejectMutation = useMutation({
    mutationFn: ({ photoId, reason }) => rejectPhoto(photoId, reason),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });


  const requalifyMutation = useMutation({
    mutationFn: (photoId) => requalifyPhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const startMutation = useMutation({
    mutationFn: () => startOrderProcessing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const completeMutation = useMutation({
    mutationFn: () => completeOrder(id, { skip_layout_reason: 'In/tải layout A4 trực tiếp từ trình duyệt' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const deliverMutation = useMutation({
    mutationFn: () => deliverOrder(id, balance > 0 ? { allow_unpaid_reason: deliverReason } : {}),
    onSuccess: () => {
      setShowDeliver(false);
      setDeliverReason('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'order', id] });
    }
  });

  const notifyReadyMutation = useMutation({
    mutationFn: () => notifyOrderReady(id),
    onSuccess: (result) => {
      if (result?.lookup_url) setLookupUrl(result.lookup_url);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'order', id] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id, cancelReason),
    onSuccess: () => {
      setShowCancel(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', id],
    queryFn: () => listPayments(id)
  });

  const paymentMutation = useMutation({
    mutationFn: () => recordPayment(id, {
      loai: paymentForm.loai,
      so_tien: Number(paymentForm.so_tien),
      hinh_thuc: paymentForm.hinh_thuc,
      ghi_chu: paymentForm.ghi_chu || undefined
    }),
    onSuccess: () => {
      setShowPayment(false);
      setPaymentForm({ loai: 'balance', so_tien: '', hinh_thuc: 'cash', ghi_chu: '' });
      setRefundConfirmed(false);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
    }
  });

  if (orderQuery.isLoading) return <LoadingState label="Đang tải chi tiết đơn..." />;
  if (orderQuery.error) return <ErrorState error={orderQuery.error} onRetry={orderQuery.refetch} />;
  if (!order) return <EmptyState title="Không tìm thấy đơn" />;

  const canComplete = approvedPhotos.length > 0;
  const payments = paymentsQuery.data?.payments || [];
  const totalAmount = Number(order.total_amount || 0);
  const amountPaid = Number(order.amount_paid || 0);
  const balance = totalAmount - amountPaid;
  const isAiProcessing = autoProcessMutation.isPending || processMutation.isPending;
  const isPhotoPipelineActive = uploadMutation.isPending || isAiProcessing;
  const progressValue = uploadMutation.isPending ? 35 : isAiProcessing ? 82 : 100;
  const progressLabel = uploadMutation.isPending ? 'Đang upload ảnh...' : isAiProcessing ? 'AI đang xử lý ảnh...' : 'Hoàn tất';

  // Mở modal thanh toán với gợi ý sẵn: chưa thu đồng nào → đặt cọc; đã có tiền → thanh toán.
  function openPayment() {
    setPaymentForm({ loai: amountPaid <= 0 ? 'deposit' : 'balance', so_tien: '', hinh_thuc: 'cash', ghi_chu: '' });
    setRefundConfirmed(false);
    setShowPayment(true);
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <div className="breadcrumb-line">
            <Link to="/staff">Staff</Link>
            <span>/</span>
            <span>{order.order_code}</span>
          </div>
          <h1>Đơn {order.order_code}</h1>
          <p>{order.customer_name} · {order.customer_phone} · {order.card_type_name}</p>
          <div className="d-flex gap-2 mt-1">
            <Badge bg={order.intake_source === 'online' ? 'info' : 'secondary'} text={order.intake_source === 'online' ? 'dark' : undefined}>
              {order.intake_source === 'online' ? 'Đơn online' : 'Tại quầy'}
            </Badge>
            <Badge bg="light" text="dark">
              {order.delivery_method === 'online' ? 'Giao online' : 'Lấy tại quầy'}
            </Badge>
          </div>
        </div>
        <div className="header-actions">
          <OrderStatusBadge status={order.status} />
          <Button
            variant="outline-primary"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || order.status !== 'pending'}
          >
            Bắt đầu xử lý
          </Button>
          <Button
            variant="outline-success"
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending || order.status === 'completed' || !canComplete}
          >
            Hoàn tất
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => { if (balance > 0) setShowDeliver(true); else deliverMutation.mutate(); }}
            disabled={deliverMutation.isPending || order.status !== 'completed'}
          >
            Đã giao
          </Button>
          <Button
            variant="outline-danger"
            onClick={() => setShowCancel(true)}
            disabled={order.status === 'delivered' || order.status === 'cancelled'}
          >
            Huỷ đơn
          </Button>
        </div>
      </div>

      <Row className="g-3">
        <Col md={3}><div className="summary-box"><span>Tổng tiền</span><strong>{formatCurrency(order.total_amount)}</strong></div></Col>
        <Col md={3}><div className="summary-box"><span>Số lượng</span><strong>{order.quantity}</strong></div></Col>
        <Col md={3}><div className="summary-box"><span>Ngày hẹn</span><strong>{order.pickup_date ? formatDate(order.pickup_date) : '-'}</strong></div></Col>
        <Col md={3}><div className="summary-box"><span>Ngày tạo</span><strong>{formatDate(order.created_at)}</strong></div></Col>
      </Row>

      <section className="app-panel">
        <div className="section-title">
          <h2>Thanh toán</h2>
          <PaymentStatusBadge total={totalAmount} paid={amountPaid} />
        </div>
        <Row className="g-3">
          <Col sm={4}><div className="summary-box"><span>Tổng tiền</span><strong>{formatCurrency(totalAmount)}</strong></div></Col>
          <Col sm={4}><div className="summary-box"><span>Đã thu</span><strong>{formatCurrency(amountPaid)}</strong></div></Col>
          <Col sm={4}><div className="summary-box"><span>Còn lại</span><strong>{formatCurrency(balance)}</strong></div></Col>
        </Row>
        <div className="mt-3">
          <Button variant="outline-primary" onClick={openPayment}>Ghi nhận thanh toán</Button>
        </div>
        {payments.length > 0 ? (
          <div className="table-responsive mt-3">
            <Table hover className="align-middle data-table">
              <thead>
                <tr><th>Thời gian</th><th>Loại</th><th>Số tiền</th><th>Hình thức</th><th>Ghi chú</th><th>Người thu</th></tr>
              </thead>
              <tbody>
                {payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="text-nowrap">{formatDate(pmt.ngay_tao)}</td>
                    <td>{PAYMENT_KIND_LABEL[pmt.loai] || pmt.loai}</td>
                    <td className={pmt.loai === 'refund' ? 'text-danger' : ''}>
                      {pmt.loai === 'refund' ? '-' : ''}{formatCurrency(pmt.so_tien)}
                    </td>
                    <td>{pmt.hinh_thuc === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</td>
                    <td>{pmt.ghi_chu || '-'}</td>
                    <td>{pmt.nguoi_thu_ten || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
      </section>

      {(startMutation.error || completeMutation.error || deliverMutation.error) ? (
        <Alert variant="danger">
          {(startMutation.error || completeMutation.error || deliverMutation.error).message}
        </Alert>
      ) : null}

      <Tabs defaultActiveKey="photos" className="work-tabs">
        <Tab eventKey="photos" title="Ảnh & AI">
          <section className="app-panel">
            <div className="section-title">
              <h2>Upload và xử lý ảnh</h2>
              <Badge bg="light" text="dark">{photos.length} ảnh</Badge>
            </div>

            <Alert variant="info" className="d-flex gap-2 align-items-start">
              <ShieldCheck size={18} aria-hidden="true" className="mt-1 flex-shrink-0" />
              <span>
                <strong>AI chỉ hỗ trợ an toàn:</strong> tách/đổi nền, căn chỉnh khung và chuẩn sáng.
                Khuôn mặt và nhận dạng được giữ nguyên (yêu cầu pháp lý với ảnh thẻ). Nhân viên luôn duyệt lại trước khi dùng.
              </span>
            </Alert>

            <Row className="g-3 align-items-end">
              <Col lg={7}>
                <Form.Group controlId="photo-upload">
                  <Form.Label>Chọn nhiều ảnh</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                    disabled={isPhotoPipelineActive}
                  />
                </Form.Group>
              </Col>
              <Col lg={5} className="d-flex gap-2 flex-wrap">
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={isPhotoPipelineActive || selectedFiles.length === 0}
                >
                  <Upload size={17} aria-hidden="true" />
                  Upload & xử lý AI
                </Button>
                {pendingAiPhotos.length > 0 ? (
                  <Button
                    variant="outline-primary"
                    onClick={() => processMutation.mutate()}
                    disabled={isPhotoPipelineActive || pendingAiPhotos.length === 0}
                  >
                    <WandSparkles size={17} aria-hidden="true" />
                    Xử lý ảnh còn lại
                  </Button>
                ) : null}
              </Col>
            </Row>

            {selectedPreviews.length > 0 ? (
              <div className="selected-preview-grid">
                {selectedPreviews.map((preview) => (
                  <div className="selected-preview" key={`${preview.name}-${preview.size}`}>
                    <img src={preview.url} alt={`Preview ${preview.name}`} />
                    <span>{preview.name}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {isPhotoPipelineActive ? (
              <div className="pipeline-progress">
                <div>
                  <strong>{progressLabel}</strong>
                  <span>Không cần bấm xử lý AI sau khi upload. Hệ thống sẽ refetch đơn khi xong.</span>
                </div>
                <ProgressBar animated now={progressValue} label={`${progressValue}%`} />
              </div>
            ) : null}
            {uploadMutation.error ? <Alert variant="danger" className="mt-3">{uploadMutation.error.message}</Alert> : null}
            {(autoProcessMutation.error || processMutation.error) ? (
              <Alert variant="danger" className="mt-3">
                {(autoProcessMutation.error || processMutation.error).message}
              </Alert>
            ) : null}
            {jobQuery.data?.job ? (
              <Alert variant={jobQuery.data.job.status === 'failed' ? 'danger' : 'info'} className="mt-3">
                Job xử lý ảnh: <strong>{jobQuery.data.job.status}</strong>
              </Alert>
            ) : null}

            {photos.length === 0 ? (
              <EmptyState title="Chưa có ảnh" description="Upload ảnh gốc để bắt đầu xử lý AI." />
            ) : (
              <div className="photo-card-grid mt-3">
                {photos.map((photo) => (
                  <div className="photo-card" key={photo.id}>
                    {photoPreviewUrl(photo) ? (
                      <button
                        type="button"
                        className="photo-card-media"
                        onClick={() => setPreviewPhoto(photo)}
                        aria-label={`Xem ảnh ${photo.original_filename || photo.id}`}
                      >
                        <img src={photoPreviewUrl(photo)} alt={photo.original_filename || 'Ảnh đơn'} />
                      </button>
                    ) : (
                      <div className="photo-card-media placeholder-thumb"><FileImage size={30} aria-hidden="true" /></div>
                    )}
                    <div className="photo-card-body">
                      <div className="photo-card-badges">
                        <PhotoStatusBadge status={photo.status} />
                        <QcStatusBadge status={photo.qc_status} />
                      </div>
                      <div className="photo-card-file" title={photo.original_filename || photo.id}>
                        {photo.original_filename || photo.id}
                      </div>
                      <div className="text-muted small">
                        {photo.width_px || '-'} x {photo.height_px || '-'} px
                        {photo.quality_score != null ? ` · QC ${Math.round(Number(photo.quality_score))}` : ''}
                      </div>
                      {Array.isArray(photo.quality_issues) && photo.quality_issues.length > 0 ? (
                        <ul className="photo-card-issues">
                          {photo.quality_issues.map((issue, index) => (
                            <li key={issue.code || index} className={issue.severity === 'fail' ? 'text-danger' : 'text-warning-emphasis'}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {photo.processing_error ? <div className="text-danger small">{photo.processing_error}</div> : null}
                    </div>
                    <div className="photo-card-actions">
                      <Button
                        size="sm"
                        variant="outline-success"
                        disabled={approveMutation.isPending || !['processed', 'approved'].includes(photo.status)}
                        onClick={() => approveMutation.mutate(photo.id)}
                      >
                        <Check size={15} aria-hidden="true" /> Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={rejectMutation.isPending || photo.status === 'rejected'}
                        onClick={() => setRejectTarget(photo)}
                      >
                        <X size={15} aria-hidden="true" /> Từ chối
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-info"
                        disabled={requalifyMutation.isPending || photo.status === 'processing' || isPhotoPipelineActive}
                        onClick={() => requalifyMutation.mutate(photo.id)}
                      >
                        <RefreshCw size={15} aria-hidden="true" /> QC
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Tab>

        <Tab eventKey="layout" title="Layout in">
          <section className="app-panel">
            <div className="section-title">
              <h2>Sắp xếp &amp; In layout (A4)</h2>
              <Badge bg="success">{approvedPhotos.length} ảnh approved</Badge>
            </div>

            {approvedPhotos.length === 0 ? (
              <EmptyState title="Chưa có ảnh approved" description="Chỉ ảnh đã duyệt mới được dàn lên layout." />
            ) : (
              <LayoutComposer
                photos={approvedPhotos.map((p) => ({ id: p.id, url: photoPreviewUrl(p) }))}
                widthMm={pricingSnapshot?.width_mm}
                heightMm={pricingSnapshot?.height_mm}
              />
            )}
          </section>
        </Tab>

        <Tab eventKey="details" title="Thông tin">
          <section className="app-panel">
            <Row className="g-3">
              <Col md={6}>
                <h2>Khách hàng</h2>
                <Table className="detail-table">
                  <tbody>
                    <tr><th>Họ tên</th><td>{order.customer_name}</td></tr>
                    <tr><th>SĐT</th><td>{order.customer_phone}</td></tr>
                    <tr><th>Ghi chú</th><td>{order.notes || '-'}</td></tr>
                  </tbody>
                </Table>
              </Col>
              <Col md={6}>
                <h2>Snapshot giá</h2>
                <Table className="detail-table">
                  <tbody>
                    <tr><th>Loại thẻ</th><td>{pricingSnapshot?.card_type_name || order.card_type_name}</td></tr>
                    <tr><th>Kích thước</th><td>{pricingSnapshot ? `${pricingSnapshot.width_mm} x ${pricingSnapshot.height_mm} mm` : '-'}</td></tr>
                    <tr><th>Giá mỗi bản</th><td>{formatCurrency(pricingSnapshot?.price_per_copy)}</td></tr>
                    <tr><th>Phí xử lý</th><td>{formatCurrency(pricingSnapshot?.processing_fee)}</td></tr>
                  </tbody>
                </Table>
              </Col>
            </Row>

            <hr />
            <h2 className="h5">Giao ảnh &amp; thông báo</h2>
            <Row className="g-3">
              <Col md={6}>
                <Table className="detail-table">
                  <tbody>
                    <tr><th>Nguồn đơn</th><td>{order.intake_source === 'online' ? 'Online' : 'Tại quầy'}</td></tr>
                    <tr><th>Hình thức giao</th><td>{order.delivery_method === 'online' ? 'Khách tải online' : 'Lấy tại quầy'}</td></tr>
                    {appointment ? (
                      <tr><th>Lịch hẹn</th><td>{formatDate(appointment.preferred_date)} · {appointment.time_slot} · {appointment.status}</td></tr>
                    ) : null}
                    <tr><th>Đã báo sẵn sàng</th><td>{order.ready_notified_at ? formatDate(order.ready_notified_at) : 'Chưa'}</td></tr>
                  </tbody>
                </Table>
              </Col>
              <Col md={6}>
                <Button
                  variant="outline-primary"
                  disabled={notifyReadyMutation.isPending}
                  onClick={() => notifyReadyMutation.mutate()}
                >
                  <Send size={16} aria-hidden="true" />
                  Gửi link cho khách
                </Button>
                <p className="text-muted small mt-2">Tạo link tra cứu kèm token và gửi email/Zalo (mô phỏng) cho khách.</p>
                {lookupUrl ? (
                  <Alert variant="success" className="mt-2">
                    Link tra cứu: <a href={lookupUrl} target="_blank" rel="noopener noreferrer">{lookupUrl}</a>
                  </Alert>
                ) : null}
                {notifyReadyMutation.error ? <Alert variant="danger" className="mt-2">{notifyReadyMutation.error.message}</Alert> : null}
              </Col>
            </Row>

            <h3 className="h6 mt-3">Thông báo đã gửi</h3>
            {notificationsQuery.data?.notifications?.length ? (
              <div className="table-responsive">
                <Table className="data-table align-middle">
                  <thead>
                    <tr><th>Thời gian</th><th>Kênh</th><th>Sự kiện</th><th>Người nhận</th><th>Trạng thái</th></tr>
                  </thead>
                  <tbody>
                    {notificationsQuery.data.notifications.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.ngay_tao)}</td>
                        <td>{item.kenh}</td>
                        <td>{item.loai_su_kien}</td>
                        <td>{item.nguoi_nhan}</td>
                        <td>{item.trang_thai}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : <p className="text-muted">Chưa có thông báo cho đơn này.</p>}
          </section>
        </Tab>
      </Tabs>

      <Modal show={Boolean(rejectTarget)} onHide={() => setRejectTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Từ chối ảnh</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Lý do</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              autoFocus
            />
          </Form.Group>
          {rejectMutation.error ? <Alert variant="danger" className="mt-3">{rejectMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setRejectTarget(null)}>Đóng</Button>
          <Button
            variant="danger"
            disabled={!rejectReason.trim() || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate({ photoId: rejectTarget.id, reason: rejectReason })}
          >
            Từ chối
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Huỷ đơn {order.order_code}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {amountPaid > 0 ? (
            <Alert variant="warning">
              Đơn đã thu <strong>{formatCurrency(amountPaid)}</strong>. Sau khi huỷ, nhớ <strong>hoàn tiền</strong> cho khách
              (ghi nhận bằng mục Thanh toán → loại “Hoàn tiền”).
            </Alert>
          ) : null}
          <Form.Group>
            <Form.Label>Lý do huỷ</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              autoFocus
            />
          </Form.Group>
          {cancelMutation.error ? <Alert variant="danger" className="mt-3">{cancelMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCancel(false)}>Đóng</Button>
          <Button
            variant="danger"
            disabled={!cancelReason.trim() || cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            Xác nhận huỷ
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeliver} onHide={() => setShowDeliver(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Giao đơn khi chưa thu đủ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            Đơn còn nợ <strong>{formatCurrency(balance)}</strong> (đã thu {formatCurrency(amountPaid)}/{formatCurrency(totalAmount)}).
            Nhập lý do giao nợ để tiếp tục, hoặc đóng lại để thu thêm tiền trước.
          </Alert>
          <Form.Group>
            <Form.Label>Lý do giao nợ</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={deliverReason}
              onChange={(event) => setDeliverReason(event.target.value)}
              autoFocus
            />
          </Form.Group>
          {deliverMutation.error ? <Alert variant="danger" className="mt-3">{deliverMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDeliver(false)}>Đóng</Button>
          <Button
            variant="secondary"
            disabled={!deliverReason.trim() || deliverMutation.isPending}
            onClick={() => deliverMutation.mutate()}
          >
            Xác nhận giao nợ
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPayment} onHide={() => setShowPayment(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Ghi nhận thanh toán</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Loại</Form.Label>
                <Form.Select
                  value={paymentForm.loai}
                  onChange={(e) => { setPaymentForm((c) => ({ ...c, loai: e.target.value })); setRefundConfirmed(false); }}
                >
                  <option value="deposit">Đặt cọc</option>
                  <option value="balance">Thanh toán</option>
                  <option value="refund">Hoàn tiền</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Hình thức</Form.Label>
                <Form.Select value={paymentForm.hinh_thuc} onChange={(e) => setPaymentForm((c) => ({ ...c, hinh_thuc: e.target.value }))}>
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Số tiền</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    value={paymentForm.so_tien}
                    onChange={(e) => setPaymentForm((c) => ({ ...c, so_tien: e.target.value }))}
                    autoFocus
                  />
                  {balance > 0 && paymentForm.loai !== 'refund' ? (
                    <Button variant="outline-secondary" onClick={() => setPaymentForm((c) => ({ ...c, so_tien: String(balance) }))}>
                      Thu đủ
                    </Button>
                  ) : null}
                </InputGroup>
                {balance > 0 ? <Form.Text>Còn lại: {formatCurrency(balance)}</Form.Text> : null}
              </Form.Group>
            </Col>
            {paymentForm.loai === 'refund' ? (
              <Col xs={12}>
                <Alert variant="warning" className="mb-0 py-2">
                  Đây là <strong>hoàn tiền</strong> (trừ vào số đã thu). Vui lòng xác nhận.
                </Alert>
                <Form.Check
                  className="mt-2"
                  label="Tôi xác nhận hoàn tiền cho khách"
                  checked={refundConfirmed}
                  onChange={(e) => setRefundConfirmed(e.target.checked)}
                />
              </Col>
            ) : null}
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Ghi chú</Form.Label>
                <Form.Control as="textarea" rows={2} value={paymentForm.ghi_chu} onChange={(e) => setPaymentForm((c) => ({ ...c, ghi_chu: e.target.value }))} />
              </Form.Group>
            </Col>
          </Row>
          {paymentMutation.error ? <Alert variant="danger" className="mt-3">{paymentMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowPayment(false)}>Đóng</Button>
          <Button disabled={!(Number(paymentForm.so_tien) > 0) || paymentMutation.isPending || (paymentForm.loai === 'refund' && !refundConfirmed)} onClick={() => paymentMutation.mutate()}>
            {paymentMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(previewPhoto)} onHide={() => setPreviewPhoto(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Xem ảnh đơn hàng</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewPhoto ? (
            <div className="photo-preview-modal">
              <Row className="g-3">
                <Col md={6}>
                  <div className="text-muted small mb-1">Ảnh gốc</div>
                  {previewPhoto.original_asset_metadata?.secure_url ? (
                    <Image src={previewPhoto.original_asset_metadata.secure_url} alt="Ảnh gốc" fluid />
                  ) : <span className="text-muted">-</span>}
                </Col>
                <Col md={6}>
                  <div className="text-muted small mb-1">Đã xử lý (giữ nguyên khuôn mặt)</div>
                  {previewPhoto.processed_asset_metadata?.secure_url ? (
                    <Image src={previewPhoto.processed_asset_metadata.secure_url} alt="Ảnh đã xử lý" fluid />
                  ) : <span className="text-muted">Chưa xử lý</span>}
                </Col>
              </Row>
              <div className="photo-preview-meta mt-3">
                <strong>{previewPhoto.original_filename || previewPhoto.id}</strong>
                <span className="d-inline-flex gap-2">
                  <PhotoStatusBadge status={previewPhoto.status} />
                  <QcStatusBadge status={previewPhoto.qc_status} />
                </span>
              </div>
              {Array.isArray(previewPhoto.quality_issues) && previewPhoto.quality_issues.length > 0 ? (
                <ul className="small mt-2 mb-0 ps-3">
                  {previewPhoto.quality_issues.map((issue, index) => (
                    <li
                      key={issue.code || index}
                      className={issue.severity === 'fail' ? 'text-danger' : 'text-warning-emphasis'}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </Modal.Body>
      </Modal>
    </div>
  );
}
