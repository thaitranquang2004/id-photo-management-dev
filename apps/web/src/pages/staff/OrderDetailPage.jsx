import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, FileImage, RotateCcw, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Col,
  Form,
  Image,
  Modal,
  ProgressBar,
  Row,
  Table,
  Tabs,
  Tab
} from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { getOrder, completeOrder, deliverOrder, startOrderProcessing } from '../../api/orders';
import {
  approvePhoto,
  batchProcessPhotos,
  getProcessingJob,
  rejectPhoto,
  uploadPhotos,
  overridePhoto
} from '../../api/photos';
import { generateLayout, getLayoutDownloadUrl, previewLayout, validateLayoutConfig } from '../../api/layouts';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import PhotoStatusBadge from '../../components/status/PhotoStatusBadge.jsx';
import { formatCurrency, formatDate } from '../../utils/format';

const terminalJobStatuses = new Set(['completed', 'failed', 'cancelled']);

function orderData(queryData) {
  return queryData || { order: null, pricing_snapshot: null, photos: [], print_layouts: [] };
}

function createLayoutPayload(orderId, selectedPhotoIds, config) {
  const layoutConfig = {
    copies_per_page: Number(config.copies_per_page),
    margin_mm: Number(config.margin_mm || 5),
    gap_mm: Number(config.gap_mm || 2)
  };
  if (config.paper_size === 'Custom') {
    layoutConfig.paper_width_mm = Number(config.paper_width_mm || 210);
    layoutConfig.paper_height_mm = Number(config.paper_height_mm || 297);
  }
  return {
    order_id: orderId,
    photo_ids: selectedPhotoIds,
    layout_type: 'grid',
    paper_size: config.paper_size === 'Custom' ? 'A4' : config.paper_size,
    add_text: config.add_text,
    layout_config: layoutConfig
  };
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [selectedLayoutPhotos, setSelectedLayoutPhotos] = useState([]);
  const [layoutConfig, setLayoutConfig] = useState({
    paper_size: 'A4',
    copies_per_page: 8,
    margin_mm: 5,
    gap_mm: 2,
    paper_width_mm: 210,
    paper_height_mm: 297,
    add_text: true
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ cloudinary_processed_public_id: '', notes: '' });
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const orderQuery = useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id)
  });

  const { order, pricing_snapshot: pricingSnapshot, photos, print_layouts: printLayouts } = orderData(orderQuery.data);
  const approvedPhotos = useMemo(() => photos.filter((photo) => photo.status === 'approved'), [photos]);
  const processablePhotos = useMemo(() => photos.filter((photo) => ['raw', 'processed'].includes(photo.status)), [photos]);

  const uploadMutation = useMutation({
    mutationFn: () => uploadPhotos(id, selectedFiles),
    onSuccess: () => {
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const processMutation = useMutation({
    mutationFn: () => batchProcessPhotos({
      order_id: id,
      photo_ids: processablePhotos.map((photo) => photo.id),
      provider: 'google_ai',
      strict_quality_check: false
    }),
    onSuccess: (result) => {
      if (result.job?.id) setActiveJobId(result.job.id);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
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

  const overrideMutation = useMutation({
    mutationFn: ({ photoId, payload }) => overridePhoto(photoId, payload),
    onSuccess: () => {
      setOverrideTarget(null);
      setOverrideForm({ cloudinary_processed_public_id: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const startMutation = useMutation({
    mutationFn: () => startOrderProcessing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const completeMutation = useMutation({
    mutationFn: () => completeOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const deliverMutation = useMutation({
    mutationFn: () => deliverOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id] })
  });

  const validateLayoutMutation = useMutation({
    mutationFn: (payload) => validateLayoutConfig(payload)
  });

  const previewMutation = useMutation({
    mutationFn: (payload) => previewLayout(payload),
    onSuccess: (result) => setPreviewUrl(result.preview_signed_url || '')
  });

  const generateMutation = useMutation({
    mutationFn: (payload) => generateLayout(payload),
    onSuccess: () => {
      setPreviewUrl('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: (layoutId) => getLayoutDownloadUrl(layoutId),
    onSuccess: (result) => {
      const url = result.layout_signed_url || result.signed_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  });

  if (orderQuery.isLoading) return <LoadingState label="Đang tải chi tiết đơn..." />;
  if (orderQuery.error) return <ErrorState error={orderQuery.error} onRetry={orderQuery.refetch} />;
  if (!order) return <EmptyState title="Không tìm thấy đơn" />;

  const layoutPayload = createLayoutPayload(id, selectedLayoutPhotos, layoutConfig);
  const canComplete = approvedPhotos.length > 0 && printLayouts.some((layout) => layout.status === 'generated');

  function toggleLayoutPhoto(photoId) {
    setSelectedLayoutPhotos((current) => (
      current.includes(photoId) ? current.filter((idValue) => idValue !== photoId) : [...current, photoId]
    ));
  }

  async function runPreview() {
    const validation = await validateLayoutMutation.mutateAsync(layoutPayload);
    if (validation.valid) previewMutation.mutate(layoutPayload);
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
            onClick={() => deliverMutation.mutate()}
            disabled={deliverMutation.isPending || order.status !== 'completed'}
          >
            Đã giao
          </Button>
        </div>
      </div>

      <Row className="g-3">
        <Col md={3}><div className="summary-box"><span>Tổng tiền</span><strong>{formatCurrency(order.total_amount)}</strong></div></Col>
        <Col md={3}><div className="summary-box"><span>Số lượng</span><strong>{order.quantity}</strong></div></Col>
        <Col md={3}><div className="summary-box"><span>Ngày hẹn</span><strong>{order.pickup_date ? formatDate(order.pickup_date) : '-'}</strong></div></Col>
        <Col md={3}><div className="summary-box"><span>Ngày tạo</span><strong>{formatDate(order.created_at)}</strong></div></Col>
      </Row>

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

            <Row className="g-3 align-items-end">
              <Col lg={7}>
                <Form.Group controlId="photo-upload">
                  <Form.Label>Chọn nhiều ảnh</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                  />
                </Form.Group>
              </Col>
              <Col lg={5} className="d-flex gap-2 flex-wrap">
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || selectedFiles.length === 0}
                >
                  <Upload size={17} aria-hidden="true" />
                  Upload ảnh
                </Button>
                <Button
                  variant="primary"
                  onClick={() => processMutation.mutate()}
                  disabled={processMutation.isPending || processablePhotos.length === 0}
                >
                  <RotateCcw size={17} aria-hidden="true" />
                  Xử lý AI
                </Button>
              </Col>
            </Row>

            {uploadMutation.isPending ? <ProgressBar animated now={65} className="mt-3" label="Đang upload" /> : null}
            {uploadMutation.error ? <Alert variant="danger" className="mt-3">{uploadMutation.error.message}</Alert> : null}
            {processMutation.error ? <Alert variant="danger" className="mt-3">{processMutation.error.message}</Alert> : null}
            {jobQuery.data?.job ? (
              <Alert variant={jobQuery.data.job.status === 'failed' ? 'danger' : 'info'} className="mt-3">
                Job xử lý ảnh: <strong>{jobQuery.data.job.status}</strong>
              </Alert>
            ) : null}

            {photos.length === 0 ? (
              <EmptyState title="Chưa có ảnh" description="Upload ảnh gốc để bắt đầu xử lý AI." />
            ) : (
              <div className="table-responsive mt-3">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Ảnh</th>
                      <th>Trạng thái</th>
                      <th>File</th>
                      <th>Lỗi xử lý</th>
                      <th className="text-end">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {photos.map((photo) => (
                      <tr key={photo.id}>
                        <td><FileImage size={20} aria-hidden="true" /></td>
                        <td><PhotoStatusBadge status={photo.status} /></td>
                        <td>
                          <div>{photo.original_filename || photo.id}</div>
                          <div className="text-muted small">{photo.width_px || '-'} x {photo.height_px || '-'} px</div>
                        </td>
                        <td className="text-danger small">{photo.processing_error || '-'}</td>
                        <td className="text-end">
                          <div className="table-actions">
                            <Button
                              size="sm"
                              variant="outline-success"
                              disabled={approveMutation.isPending || !['processed', 'approved'].includes(photo.status)}
                              onClick={() => approveMutation.mutate(photo.id)}
                            >
                              <Check size={15} aria-hidden="true" />
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={rejectMutation.isPending || photo.status === 'rejected'}
                              onClick={() => setRejectTarget(photo)}
                            >
                              <X size={15} aria-hidden="true" />
                              Từ chối
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => {
                                setOverrideTarget(photo);
                                setOverrideForm({ cloudinary_processed_public_id: '', notes: '' });
                              }}
                            >
                              Override
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
        </Tab>

        <Tab eventKey="layout" title="Layout in">
          <section className="app-panel">
            <div className="section-title">
              <h2>Tạo layout in</h2>
              <Badge bg="success">{approvedPhotos.length} ảnh approved</Badge>
            </div>

            {approvedPhotos.length === 0 ? (
              <EmptyState title="Chưa có ảnh approved" description="Chỉ ảnh đã duyệt mới được chọn để tạo layout." />
            ) : (
              <>
                <Row className="g-3">
                  <Col lg={7}>
                    <div className="table-responsive">
                      <Table hover className="align-middle data-table">
                        <thead>
                          <tr>
                            <th>Chọn</th>
                            <th>Ảnh</th>
                            <th>Trạng thái</th>
                            <th>Ngày tạo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvedPhotos.map((photo) => (
                            <tr key={photo.id}>
                              <td>
                                <Form.Check
                                  checked={selectedLayoutPhotos.includes(photo.id)}
                                  onChange={() => toggleLayoutPhoto(photo.id)}
                                  aria-label={`Chọn ảnh ${photo.id}`}
                                />
                              </td>
                              <td>{photo.original_filename || photo.id}</td>
                              <td><PhotoStatusBadge status={photo.status} /></td>
                              <td>{formatDate(photo.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Col>
                  <Col lg={5}>
                    <div className="layout-config">
                      <Form.Group className="mb-3">
                        <Form.Label>Khổ giấy</Form.Label>
                        <Form.Select
                          value={layoutConfig.paper_size}
                          onChange={(event) => setLayoutConfig((current) => ({ ...current, paper_size: event.target.value }))}
                        >
                          <option value="10x15">10x15</option>
                          <option value="A4">A4</option>
                          <option value="Custom">Custom</option>
                        </Form.Select>
                      </Form.Group>
                      {layoutConfig.paper_size === 'Custom' ? (
                        <Row className="g-2">
                          <Col>
                            <Form.Group className="mb-3">
                              <Form.Label>Rộng mm</Form.Label>
                              <Form.Control
                                type="number"
                                value={layoutConfig.paper_width_mm}
                                onChange={(event) => setLayoutConfig((current) => ({ ...current, paper_width_mm: event.target.value }))}
                              />
                            </Form.Group>
                          </Col>
                          <Col>
                            <Form.Group className="mb-3">
                              <Form.Label>Cao mm</Form.Label>
                              <Form.Control
                                type="number"
                                value={layoutConfig.paper_height_mm}
                                onChange={(event) => setLayoutConfig((current) => ({ ...current, paper_height_mm: event.target.value }))}
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                      ) : null}
                      <Form.Group className="mb-3">
                        <Form.Label>Số ảnh/trang</Form.Label>
                        <Form.Select
                          value={layoutConfig.copies_per_page}
                          onChange={(event) => setLayoutConfig((current) => ({ ...current, copies_per_page: event.target.value }))}
                        >
                          {[4, 6, 8, 9, 12].map((count) => <option value={count} key={count}>{count}</option>)}
                        </Form.Select>
                      </Form.Group>
                      <Row className="g-2">
                        <Col>
                          <Form.Group className="mb-3">
                            <Form.Label>Lề mm</Form.Label>
                            <Form.Control
                              type="number"
                              value={layoutConfig.margin_mm}
                              onChange={(event) => setLayoutConfig((current) => ({ ...current, margin_mm: event.target.value }))}
                            />
                          </Form.Group>
                        </Col>
                        <Col>
                          <Form.Group className="mb-3">
                            <Form.Label>Khoảng cách mm</Form.Label>
                            <Form.Control
                              type="number"
                              value={layoutConfig.gap_mm}
                              onChange={(event) => setLayoutConfig((current) => ({ ...current, gap_mm: event.target.value }))}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Form.Check
                        className="mb-3"
                        checked={layoutConfig.add_text}
                        onChange={(event) => setLayoutConfig((current) => ({ ...current, add_text: event.target.checked }))}
                        label="In mã đơn dưới ảnh"
                      />
                      {validateLayoutMutation.data?.warnings?.length ? (
                        <Alert variant="warning">{validateLayoutMutation.data.warnings.join(', ')}</Alert>
                      ) : null}
                      {(validateLayoutMutation.error || previewMutation.error || generateMutation.error) ? (
                        <Alert variant="danger">
                          {(validateLayoutMutation.error || previewMutation.error || generateMutation.error).message}
                        </Alert>
                      ) : null}
                      <div className="panel-actions compact">
                        <Button
                          variant="outline-primary"
                          onClick={runPreview}
                          disabled={selectedLayoutPhotos.length === 0 || previewMutation.isPending}
                        >
                          Preview
                        </Button>
                        <Button
                          onClick={() => generateMutation.mutate(layoutPayload)}
                          disabled={selectedLayoutPhotos.length === 0 || generateMutation.isPending}
                        >
                          Generate layout
                        </Button>
                      </div>
                    </div>
                  </Col>
                </Row>
                {previewUrl ? (
                  <div className="layout-preview">
                    <Image src={previewUrl} alt="Preview layout in" fluid />
                  </div>
                ) : null}
              </>
            )}

            <div className="section-title mt-4">
              <h2>Layout đã tạo</h2>
            </div>
            {printLayouts.length === 0 ? (
              <EmptyState title="Chưa có layout" description="Layout generated sẽ xuất hiện sau khi tạo thành công." />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Loại</th>
                      <th>Khổ giấy</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th className="text-end">Tải</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printLayouts.map((layout) => (
                      <tr key={layout.id}>
                        <td>{layout.layout_type}</td>
                        <td>{layout.paper_size}</td>
                        <td><Badge bg={layout.status === 'generated' ? 'success' : 'secondary'}>{layout.status}</Badge></td>
                        <td>{formatDate(layout.created_at)}</td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            disabled={downloadMutation.isPending || layout.status !== 'generated'}
                            onClick={() => downloadMutation.mutate(layout.id)}
                          >
                            <Download size={15} aria-hidden="true" />
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
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

      <Modal show={Boolean(overrideTarget)} onHide={() => setOverrideTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Override ảnh xử lý</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Cloudinary processed public ID</Form.Label>
            <Form.Control
              value={overrideForm.cloudinary_processed_public_id}
              onChange={(event) => setOverrideForm((current) => ({ ...current, cloudinary_processed_public_id: event.target.value }))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Ghi chú</Form.Label>
            <Form.Control
              value={overrideForm.notes}
              onChange={(event) => setOverrideForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </Form.Group>
          {overrideMutation.error ? <Alert variant="danger" className="mt-3">{overrideMutation.error.message}</Alert> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setOverrideTarget(null)}>Đóng</Button>
          <Button
            disabled={!overrideForm.cloudinary_processed_public_id || overrideMutation.isPending}
            onClick={() => overrideMutation.mutate({ photoId: overrideTarget.id, payload: overrideForm })}
          >
            Lưu override
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
