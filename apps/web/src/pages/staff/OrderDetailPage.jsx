import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, FileImage, RefreshCw, Send, ShieldCheck, WandSparkles, X } from 'lucide-react';
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
import { getOrder, completeOrder, deliverOrder, notifyOrderReady, cancelOrder } from '../../api/orders';
import { listNotifications } from '../../api/notifications';
import {
  approvePhoto,
  batchProcessPhotos,
  getProcessingJob,
  getPhotoDownloadUrl,
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
import PhotoCropModal from '../../components/common/PhotoCropModal.jsx';
import { formatCurrency, formatDate } from '../../utils/format';
import { cardCropRatio } from '../../utils/cardSize.js';
import { useToast } from '../../hooks/useToast.jsx';

const PAYMENT_KIND_LABEL = { deposit: 'Đặt cọc', balance: 'Thanh toán', refund: 'Hoàn tiền' };

const terminalJobStatuses = new Set(['hoan_tat', 'that_bai', 'da_huy']);
const RAW_PHOTO_APPROVAL_QC_SCORE = 80;

function orderData(queryData) {
  return queryData || { order: null, pricing_snapshot: null, photos: [], appointment: null };
}

function photoPreviewUrl(photo) {
  if (photo.ngay_don_dep) return null;
  return photo.metadata_anh_xu_ly?.secure_url
    || photo.metadata_anh_goc?.secure_url
    || null;
}

function canApprovePhoto(photo) {
  return ['da_xu_ly', 'da_duyet'].includes(photo.trang_thai)
    || (photo.trang_thai === 'anh_goc' && Number(photo.diem_chat_luong) > RAW_PHOTO_APPROVAL_QC_SCORE);
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [croppedFlags, setCroppedFlags] = useState([]);
  const [cropIndex, setCropIndex] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
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

  const orderQuery = useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id)
  });

  const { order, pricing_snapshot: pricingSnapshot, photos, appointment } = orderData(orderQuery.data);
  const { aspect: cropAspect, label: cropRatioLabel } = cardCropRatio(pricingSnapshot);
  // Ép cắt khổ trước khi upload để đảm bảo chất lượng (chỉ khi đơn có tỷ lệ khổ thẻ).
  const requireCrop = Boolean(cropAspect);

  function clearSelectedFiles() {
    setSelectedFiles([]);
    setCroppedFlags([]);
    setFileInputKey((key) => key + 1);
  }

  // Chọn ảnh xong tự mở modal cắt cho ảnh đầu tiên (nếu đơn có khổ thẻ).
  function handleSelectFiles(event) {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    setCroppedFlags(new Array(files.length).fill(false));
    if (!files.length) return;

    if (requireCrop) {
      setCropIndex(0);
      return;
    }

    uploadMutation.mutate(files);
  }

  // Sau khi cắt 1 ảnh: đánh dấu đã cắt rồi tự nhảy sang ảnh chưa cắt kế tiếp.
  function applyCroppedFile(index, croppedFile) {
    const nextFiles = selectedFiles.map((file, i) => (i === index ? croppedFile : file));
    const nextFlags = croppedFlags.slice();
    nextFlags[index] = true;
    setSelectedFiles(nextFiles);
    setCroppedFlags(nextFlags);
    const nextIndex = nextFlags.findIndex((done) => !done);
    if (nextIndex === -1) {
      setCropIndex(null);
      uploadMutation.mutate(nextFiles);
      return;
    }
    setCropIndex(nextIndex);
  }

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'order', id],
    queryFn: () => listNotifications({ don_hang_id: id, limit: 20 })
  });
  const approvedPhotos = useMemo(() => photos.filter((photo) => photo.trang_thai === 'da_duyet'), [photos]);

  const processPhotoMutation = useMutation({
    mutationFn: (photoId) => batchProcessPhotos({
      don_hang_id: id,
      danh_sach_anh_id: [photoId],
      nha_cung_cap: 'google_ai',
      kiem_tra_nghiem_ngat: false
    }),
    onSuccess: (result) => {
      if (result.job?.id) setActiveJobId(result.job.id);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (files) => uploadPhotos(id, files),
    onSuccess: () => {
      clearSelectedFiles();
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Đã upload ảnh. Chọn từng ảnh để xử lý AI khi sẵn sàng.');
    }
  });

  const jobQuery = useQuery({
    queryKey: ['processing-jobs', activeJobId],
    queryFn: () => getProcessingJob(activeJobId),
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.job?.trang_thai;
      return status && !terminalJobStatuses.has(status) ? 1500 : false;
    }
  });

  useEffect(() => {
    const status = jobQuery.data?.job?.trang_thai;
    if (status && terminalJobStatuses.has(status)) {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  }, [id, jobQuery.data?.job?.trang_thai, queryClient]);

  const approveMutation = useMutation({
    mutationFn: (photoId) => approvePhoto(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Đã duyệt ảnh');
    }
  });

  const downloadPhotoMutation = useMutation({
    mutationFn: (photoId) => getPhotoDownloadUrl(photoId),
    onSuccess: (result) => {
      if (result.signed_url) window.open(result.signed_url, '_blank', 'noopener,noreferrer');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ photoId, ly_do }) => rejectPhoto(photoId, ly_do),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Đã từ chối ảnh');
    }
  });


  const requalifyMutation = useMutation({
    mutationFn: (photoId) => requalifyPhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const completeMutation = useMutation({
    mutationFn: () => completeOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Đã hoàn tất đơn');
    }
  });

  const deliverMutation = useMutation({
    mutationFn: () => deliverOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'order', id] });
      toast.success('Đã giao đơn');
    }
  });

  const notifyReadyMutation = useMutation({
    mutationFn: () => notifyOrderReady(id),
    onSuccess: (result) => {
      if (result?.lookup_url) setLookupUrl(result.lookup_url);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'order', id] });
      toast.success(result?.order?.trang_thai === 'hoan_tat' ? 'Đã gửi link và hoàn tất đơn' : 'Đã gửi link cho khách');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id, cancelReason),
    onSuccess: () => {
      setShowCancel(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Đã huỷ đơn');
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
      toast.success('Đã ghi nhận thanh toán');
    }
  });

  if (orderQuery.isLoading) return <LoadingState label="Đang tải chi tiết đơn..." />;
  if (orderQuery.error) return <ErrorState error={orderQuery.error} onRetry={orderQuery.refetch} />;
  if (!order) return <EmptyState title="Không tìm thấy đơn" />;

  const canComplete = approvedPhotos.length > 0;
  const payments = paymentsQuery.data?.payments || [];
  const totalAmount = Number(order.tong_tien || 0);
  const amountPaid = Number(order.da_thanh_toan || 0);
  const balance = totalAmount - amountPaid;
  const isAiProcessing = processPhotoMutation.isPending;
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
      <Row className="g-4 order-detail-layout">
        <Col xxl={4}>
          <aside className="order-detail-sidebar">
      <div className="page-header">
        <div>
          <div className="breadcrumb-line">
            <Link to="/staff">Staff</Link>
            <span>/</span>
            <span>{order.ma_don}</span>
          </div>
          <h1>Đơn {order.ma_don}</h1>
          <p>{order.ten_khach_hang} · {order.sdt_khach_hang} · {order.ten_loai_the}</p>
          <div className="order-detail-meta mt-1">
            <Badge bg={order.nguon_don === 'gui_anh_tu_xa' ? 'info' : 'secondary'} text={order.nguon_don === 'gui_anh_tu_xa' ? 'dark' : undefined}>
              {order.nguon_don === 'gui_anh_tu_xa' ? 'Khách gửi ảnh' : order.nguon_don === 'in_lai' ? 'In lại' : 'Tại tiệm'}
            </Badge>
            <Badge bg="light" text="dark">
              {order.hinh_thuc_giao === 'lay_file_truc_tuyen' ? 'Lấy file trực tuyến' : order.hinh_thuc_giao === 'hen_lay_hinh' ? 'Hẹn lấy hình' : 'Lấy hình ngay'}
            </Badge>
            <OrderStatusBadge status={order.trang_thai} />
          </div>
        </div>
        <div className="header-actions order-detail-status-actions">
          <Button
            variant="outline-success"
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending || order.trang_thai === 'hoan_tat' || !canComplete}
          >
            Hoàn tất
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => deliverMutation.mutate()}
            disabled={deliverMutation.isPending || order.trang_thai !== 'hoan_tat' || balance > 0}
          >
            Đã giao
          </Button>
          <Button
            variant="outline-danger"
            onClick={() => setShowCancel(true)}
            disabled={order.trang_thai === 'da_giao' || order.trang_thai === 'da_huy'}
          >
            Huỷ đơn
          </Button>
        </div>
      </div>

      <Row className="g-3">
        <Col sm={6}><div className="summary-box"><span>Tổng tiền</span><strong>{formatCurrency(order.tong_tien)}</strong></div></Col>
        <Col sm={6}><div className="summary-box"><span>Số lượng</span><strong>{order.hinh_thuc_giao === 'lay_file_truc_tuyen' ? 'Không áp dụng' : order.so_luong}</strong></div></Col>
        <Col sm={6}><div className="summary-box"><span>Ngày hẹn</span><strong>{order.ngay_hen_lay ? formatDate(order.ngay_hen_lay) : '-'}</strong></div></Col>
        <Col sm={6}><div className="summary-box"><span>Ngày tạo</span><strong>{formatDate(order.ngay_tao)}</strong></div></Col>
      </Row>

      <section className="app-panel">
        <div className="section-title">
          <h2>Thanh toán</h2>
          <PaymentStatusBadge total={totalAmount} paid={amountPaid} />
        </div>
        <Row className="g-3">
          <Col xs={12}><div className="summary-box"><span>Tổng tiền</span><strong>{formatCurrency(totalAmount)}</strong></div></Col>
          <Col xs={12}><div className="summary-box"><span>Đã thu</span><strong>{formatCurrency(amountPaid)}</strong></div></Col>
          <Col xs={12}><div className="summary-box"><span>Còn lại</span><strong>{formatCurrency(balance)}</strong></div></Col>
        </Row>
        <div className="mt-3">
          <Button variant="outline-primary" onClick={openPayment}>Ghi nhận thanh toán</Button>
        </div>
        {order.trang_thai === 'hoan_tat' && balance > 0 ? (
          <Alert variant="warning" className="mt-3 mb-0">
            Cần thu đủ {formatCurrency(balance)} còn lại trước khi giao đơn.
          </Alert>
        ) : null}
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

      {(completeMutation.error || deliverMutation.error) ? (
        <Alert variant="danger">
          {(completeMutation.error || deliverMutation.error).message}
        </Alert>
      ) : null}

          </aside>
        </Col>

        <Col xxl={8}>
          <main className="order-detail-workspace">
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
                Khuôn mặt và nhận dạng được giữ nguyên.
              </span>
            </Alert>

            <Row className="g-3 align-items-end mb-3">
              <Col lg={12}>
                <Form.Group controlId="photo-upload">
                  <Form.Label>Chọn nhiều ảnh</Form.Label>
                  <Form.Control
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSelectFiles}
                    disabled={isPhotoPipelineActive}
                  />
                </Form.Group>
              </Col>
            </Row>

            {isPhotoPipelineActive ? (
              <div className="pipeline-progress">
                <div>
                  <strong>{progressLabel}</strong>
                  <span>Hệ thống sẽ cập nhật ảnh sau khi hoàn tất thao tác.</span>
                </div>
                <ProgressBar animated now={progressValue} label={`${progressValue}%`} />
              </div>
            ) : null}
            {uploadMutation.error ? (
              <Alert variant="danger" className="mt-3 d-flex justify-content-between align-items-center gap-3">
                <span>{uploadMutation.error.message}</span>
                {selectedFiles.length > 0 ? (
                  <Button size="sm" variant="outline-danger" onClick={() => uploadMutation.mutate(selectedFiles)}>
                    Thử lại upload
                  </Button>
                ) : null}
              </Alert>
            ) : null}
            {processPhotoMutation.error ? (
              <Alert variant="danger" className="mt-3">
                {processPhotoMutation.error.message}
              </Alert>
            ) : null}
            {jobQuery.data?.job ? (
              <Alert variant={jobQuery.data.job.trang_thai === 'that_bai' ? 'danger' : 'info'} className="mt-3">
                Job xử lý ảnh: <strong>{jobQuery.data.job.trang_thai}</strong>
              </Alert>
            ) : null}

            {photos.length === 0 ? (
              <EmptyState title="Chưa có ảnh" description="Upload ảnh gốc đã cắt để đưa vào danh sách chờ xử lý." />
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
                        <PhotoStatusBadge status={photo.trang_thai} />
                        <QcStatusBadge status={photo.trang_thai_qc} />
                      </div>
                      <div className="photo-card-file" title={photo.original_filename || photo.id}>
                        {photo.original_filename || photo.id}
                      </div>
                      <div className="text-muted small">
                        {photo.rong_px || '-'} x {photo.cao_px || '-'} px
                        {photo.diem_chat_luong != null ? ` · QC ${Math.round(Number(photo.diem_chat_luong))}` : ''}
                      </div>
                      {Array.isArray(photo.loi_chat_luong) && photo.loi_chat_luong.length > 0 ? (
                        <ul className="photo-card-issues">
                          {photo.loi_chat_luong.map((issue, index) => (
                            <li key={issue.code || index} className={issue.severity === 'fail' ? 'text-danger' : 'text-warning-emphasis'}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {photo.loi_xu_ly ? <div className="text-danger small">{photo.loi_xu_ly}</div> : null}
                    </div>
                    <div className="photo-card-actions">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={processPhotoMutation.isPending || photo.trang_thai !== 'anh_goc'}
                        onClick={() => processPhotoMutation.mutate(photo.id)}
                      >
                        <WandSparkles size={15} aria-hidden="true" /> Xử lý AI
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-success"
                        disabled={approveMutation.isPending || !canApprovePhoto(photo)}
                        onClick={() => approveMutation.mutate(photo.id)}
                      >
                        <Check size={15} aria-hidden="true" /> Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={rejectMutation.isPending || photo.trang_thai === 'tu_choi'}
                        onClick={() => setRejectTarget(photo)}
                      >
                        <X size={15} aria-hidden="true" /> Từ chối
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-info"
                        disabled={requalifyMutation.isPending || photo.trang_thai === 'dang_xu_ly' || isPhotoPipelineActive}
                        onClick={() => requalifyMutation.mutate(photo.id)}
                      >
                        <RefreshCw size={15} aria-hidden="true" /> QC
                      </Button>
                      <Button
                        size="sm"
                        className="photo-card-download"
                        variant="outline-secondary"
                        disabled={!photoPreviewUrl(photo) || (downloadPhotoMutation.isPending && downloadPhotoMutation.variables === photo.id)}
                        onClick={() => downloadPhotoMutation.mutate(photo.id)}
                      >
                        <Download size={15} aria-hidden="true" />
                        {downloadPhotoMutation.isPending && downloadPhotoMutation.variables === photo.id ? 'Đang tạo file...' : 'Tải ảnh'}
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
              <Badge bg="success">{approvedPhotos.length} ảnh đã duyệt</Badge>
            </div>

            {approvedPhotos.length === 0 ? (
              <EmptyState title="Chưa có ảnh đã duyệt" description="Chỉ ảnh đã duyệt mới được dàn lên layout." />
            ) : (
              <LayoutComposer
                photos={approvedPhotos.map((p) => ({ id: p.id, url: photoPreviewUrl(p) }))}
                widthMm={pricingSnapshot?.rong_mm}
                heightMm={pricingSnapshot?.cao_mm}
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
                    <tr><th>Họ tên</th><td>{order.ten_khach_hang}</td></tr>
                    <tr><th>SĐT</th><td>{order.sdt_khach_hang}</td></tr>
                    <tr><th>Ghi chú</th><td>{order.ghi_chu || '-'}</td></tr>
                  </tbody>
                </Table>
              </Col>
              <Col md={6}>
                <h2>Snapshot giá</h2>
                <Table className="detail-table">
                  <tbody>
                    <tr><th>Loại thẻ</th><td>{pricingSnapshot?.ten_loai_the || order.ten_loai_the}</td></tr>
                    <tr><th>Kích thước</th><td>{pricingSnapshot ? `${pricingSnapshot.rong_mm} x ${pricingSnapshot.cao_mm} mm` : '-'}</td></tr>
                    {pricingSnapshot?.gia_file_truc_tuyen !== null && pricingSnapshot?.gia_file_truc_tuyen !== undefined ? (
                      <tr><th>Giá file trực tuyến</th><td>{formatCurrency(pricingSnapshot.gia_file_truc_tuyen)} / đơn</td></tr>
                    ) : (
                      <>
                        <tr><th>Giá mỗi bản</th><td>{formatCurrency(pricingSnapshot?.gia_moi_ban)}</td></tr>
                        <tr><th>Phí xử lý</th><td>{formatCurrency(pricingSnapshot?.phi_xu_ly)}</td></tr>
                      </>
                    )}
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
                    <tr><th>Nguồn đơn</th><td>{order.nguon_don === 'gui_anh_tu_xa' ? 'Khách gửi ảnh' : order.nguon_don === 'in_lai' ? 'In lại' : 'Tại tiệm'}</td></tr>
                    <tr><th>Hình thức giao</th><td>{order.hinh_thuc_giao === 'lay_file_truc_tuyen' ? 'Khách tải file trực tuyến' : order.hinh_thuc_giao === 'hen_lay_hinh' ? 'Hẹn lấy hình' : 'Lấy hình ngay'}</td></tr>
                    {appointment ? (
                      <tr><th>Lịch hẹn</th><td>{formatDate(appointment.ngay_hen)} · {appointment.khung_gio} · {appointment.trang_thai}</td></tr>
                    ) : null}
                    <tr><th>Đã báo sẵn sàng</th><td>{order.ngay_bao_san_sang ? formatDate(order.ngay_bao_san_sang) : 'Chưa'}</td></tr>
                  </tbody>
                </Table>
              </Col>
              <Col md={6}>
                <Button
                  variant="outline-primary"
                  disabled={notifyReadyMutation.isPending || approvedPhotos.length === 0 || order.trang_thai === 'da_huy'}
                  onClick={() => notifyReadyMutation.mutate()}
                >
                  <Send size={16} aria-hidden="true" />
                  Gửi link cho khách
                </Button>
                <p className="text-muted small mt-2">
                  {approvedPhotos.length === 0
                    ? 'Cần duyệt ít nhất một ảnh trước khi gửi link.'
                    : 'Gửi link tra cứu (SĐT + mã đơn) qua email/Zalo (mô phỏng) và chuyển đơn sang Hoàn tất.'}
                </p>
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
          </main>
        </Col>
      </Row>

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
            onClick={() => rejectMutation.mutate({ photoId: rejectTarget.id, ly_do: rejectReason })}
          >
            Từ chối
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Huỷ đơn {order.ma_don}</Modal.Title>
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
                  {previewPhoto.metadata_anh_goc?.secure_url ? (
                    <Image src={previewPhoto.metadata_anh_goc.secure_url} alt="Ảnh gốc" fluid />
                  ) : <span className="text-muted">-</span>}
                </Col>
                <Col md={6}>
                  <div className="text-muted small mb-1">Đã xử lý (giữ nguyên khuôn mặt)</div>
                  {previewPhoto.metadata_anh_xu_ly?.secure_url ? (
                    <Image src={previewPhoto.metadata_anh_xu_ly.secure_url} alt="Ảnh đã xử lý" fluid />
                  ) : <span className="text-muted">Chưa xử lý</span>}
                </Col>
              </Row>
              <div className="photo-preview-meta mt-3">
                <strong>{previewPhoto.original_filename || previewPhoto.id}</strong>
                <span className="d-inline-flex gap-2">
                  <PhotoStatusBadge status={previewPhoto.trang_thai} />
                  <QcStatusBadge status={previewPhoto.trang_thai_qc} />
                </span>
              </div>
              {Array.isArray(previewPhoto.loi_chat_luong) && previewPhoto.loi_chat_luong.length > 0 ? (
                <ul className="small mt-2 mb-0 ps-3">
                  {previewPhoto.loi_chat_luong.map((issue, index) => (
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

      {cropIndex !== null && selectedFiles[cropIndex] ? (
        <PhotoCropModal
          file={selectedFiles[cropIndex]}
          aspect={cropAspect}
          ratioLabel={cropRatioLabel}
          onConfirm={(croppedFile) => applyCroppedFile(cropIndex, croppedFile)}
          onClose={() => {
            setCropIndex(null);
            clearSelectedFiles();
          }}
        />
      ) : null}
    </div>
  );
}
