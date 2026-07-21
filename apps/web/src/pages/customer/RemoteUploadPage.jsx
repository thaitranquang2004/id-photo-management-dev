import { CheckCircle2, ImageUp, Mail, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Col, Container, Form, Modal, Row } from 'react-bootstrap';
import { checkPublicPhotoQuality, getPublicCardTypes } from '../../api/public.js';
import { submitOnlineRequest } from '../../api/intake.js';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import PublicTopbar from '../../components/layout/PublicTopbar.jsx';
import { formatCurrency } from '../../utils/format.js';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { emailRule, vietnamesePhoneRule } from '../../utils/validation.js';

const pickupSlots = ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'];
const MIN_QC_SCORE_TO_SUBMIT = 60;
const qcStatusMeta = {
  dat: { label: 'QC đạt', variant: 'success' },
  canh_bao: { label: 'QC cảnh báo', variant: 'warning' },
  loi: { label: 'QC lỗi', variant: 'danger' }
};

export default function RemoteUploadPage() {
  const [cards, setCards] = useState([]);
  const [onlineFilePrice, setOnlineFilePrice] = useState(null);
  const [files, setFiles] = useState([]);
  const [qcResults, setQcResults] = useState({});
  const [qcCheckingIds, setQcCheckingIds] = useState([]);
  const [qcError, setQcError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { errors, clearError, validate } = useFormErrors();
  const previewUrlsRef = useRef(new Set());
  const qcRunRef = useRef(0);
  const [form, setForm] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    email: '',
    loai_the_id: '',
    so_luong: 4,
    hinh_thuc_giao: 'hen_lay_hinh',
    ngay_hen_lay: '',
    khung_gio_lay: '',
    ghi_chu: ''
  });

  useEffect(() => {
    getPublicCardTypes()
      .then((data) => {
        setCards(data.card_types || []);
        setOnlineFilePrice(data.gia_file_truc_tuyen_hien_hanh ?? null);
        setError('');
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    clearError(name);
    if (name === 'loai_the_id') {
      qcRunRef.current += 1;
      setQcResults({});
      setQcCheckingIds([]);
      setQcError('');
      if (files.length > 0) void runQualityCheck(files, value);
    }
  }

  function handleFiles(event) {
    qcRunRef.current += 1;
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();

    const selectedFiles = Array.from(event.target.files || []).map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return {
        id: `${file.name}-${file.lastModified}-${file.size}-${index}-${Date.now()}`,
        file,
        previewUrl
      };
    });

    setFiles(selectedFiles);
    setQcResults({});
    setQcCheckingIds([]);
    setQcError('');
    if (selectedFiles.length > 0 && form.loai_the_id) void runQualityCheck(selectedFiles, form.loai_the_id);
  }

  function removeFile(fileId) {
    const removed = files.find((item) => item.id === fileId);
    const remainingFiles = files.filter((item) => item.id !== fileId);
    qcRunRef.current += 1;
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrlsRef.current.delete(removed.previewUrl);
    }
    setFiles(remainingFiles);
    setQcResults({});
    setQcCheckingIds([]);
    setQcError('');
    if (remainingFiles.length > 0 && form.loai_the_id) void runQualityCheck(remainingFiles, form.loai_the_id);
  }

  async function runQualityCheck(filesToCheck, cardTypeId) {
    if (!cardTypeId || filesToCheck.length === 0) return;

    const runId = qcRunRef.current + 1;
    qcRunRef.current = runId;
    setQcError('');
    setQcCheckingIds(filesToCheck.map((item) => item.id));

    for (const item of filesToCheck) {
      try {
        const result = await checkPublicPhotoQuality({ file: item.file, loai_the_id: cardTypeId });
        if (qcRunRef.current === runId) {
          setQcResults((current) => ({ ...current, [item.id]: result }));
        }
      } catch (requestError) {
        if (qcRunRef.current === runId) {
          setQcError(requestError.message || 'Không thể kiểm tra chất lượng ảnh. Vui lòng thử lại.');
        }
      } finally {
        if (qcRunRef.current === runId) {
          setQcCheckingIds((current) => current.filter((id) => id !== item.id));
        }
      }
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate(form, {
      ho_ten: 'Vui lòng nhập họ tên',
      so_dien_thoai: vietnamesePhoneRule,
      email: emailRule,
      loai_the_id: 'Vui lòng chọn loại thẻ',
      ...(form.hinh_thuc_giao === 'hen_lay_hinh' ? {
        so_luong: { message: 'Vui lòng nhập số lượng tối thiểu 4', validate: (value) => Number(value) >= 4 ? null : 'Mỗi đơn tối thiểu 4 tấm' },
        ngay_hen_lay: 'Vui lòng chọn ngày lấy hình',
        khung_gio_lay: 'Vui lòng chọn khung giờ lấy'
      } : {})
    })) return;
    if (files.length === 0) {
      setError('Vui lòng chọn ít nhất một ảnh cần xử lý.');
      return;
    }
    if (qcCheckingIds.length > 0) {
      setError('Ảnh đang được kiểm tra chất lượng. Vui lòng chờ QC hoàn tất.');
      return;
    }
    if (filesBelowQcThreshold.length > 0) {
      setError(`Mỗi ảnh cần đạt tối thiểu ${MIN_QC_SCORE_TO_SUBMIT} điểm QC trước khi gửi. Vui lòng bỏ hoặc thay ảnh chưa đạt.`);
      return;
    }
    if (form.hinh_thuc_giao === 'lay_file_truc_tuyen' && (onlineFilePrice === null || onlineFilePrice === undefined)) {
      setMessage('');
      setError('Tiệm chưa cấu hình giá file trực tuyến. Vui lòng chọn hẹn lấy hình in hoặc liên hệ tiệm.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const fields = { ...form };
      if (form.hinh_thuc_giao === 'lay_file_truc_tuyen') delete fields.so_luong;
      await submitOnlineRequest({ fields, files: files.map((item) => item.file) });
      setMessage('Đã gửi yêu cầu thành công. Tiệm sẽ duyệt ảnh và liên hệ xác nhận với bạn qua email.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const isOnlineFileDelivery = form.hinh_thuc_giao === 'lay_file_truc_tuyen';
  const hasOnlineFilePrice = onlineFilePrice !== null && onlineFilePrice !== undefined;
  const filesBelowQcThreshold = files.filter((item) => {
    const score = Number(qcResults[item.id]?.diem_chat_luong);
    return !Number.isFinite(score) || score < MIN_QC_SCORE_TO_SUBMIT;
  });
  const canSubmitPhotos = files.length > 0 && qcCheckingIds.length === 0 && filesBelowQcThreshold.length === 0;

  const selectedCard = cards.find((card) => card.id === form.loai_the_id);

  const estimatedPrintTotal = selectedCard?.gia_moi_ban_hien_hanh != null
    ? Number(selectedCard.gia_moi_ban_hien_hanh) * Number(form.so_luong || 0)
    + Number(selectedCard.phi_xu_ly_hien_hanh || 0) : null;
  return (
    <div className="public-page">
      <Container>
        <PublicTopbar />

        <Row className="g-4 align-items-start">
          <Col lg={5}>
            <section className="app-panel public-panel">
              <div className="public-heading public-guide-heading">
                <span className="lookup-badge">Khách hàng</span>
                <h1>Gửi ảnh để tiệm xử lý</h1>
                <p>Tạo yêu cầu xử lý ảnh thẻ từ xa. File trực tuyến chỉ tải được khi đơn đã giao và thanh toán đủ.</p>
              </div>

              <div className="lookup-tips public-guide-tips" aria-label="Quy trình gửi ảnh">
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><ImageUp size={16} aria-hidden="true" /></span>
                  <div><strong>1. Chọn ảnh</strong><span>Gửi ảnh JPEG, PNG hoặc WEBP cần xử lý.</span></div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Mail size={16} aria-hidden="true" /></span>
                  <div><strong>2. Nhận xác nhận</strong><span>Thông tin đơn được gửi về email.</span></div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><CheckCircle2 size={16} aria-hidden="true" /></span>
                  <div><strong>3. Tra cứu đơn</strong><span>Theo dõi tiến độ và tải file khi sẵn sàng.</span></div>
                </div>
              </div>

              <button
                className="public-guide-image-button"
                type="button"
                onClick={() => setShowGuide(true)}
                aria-label="Mở ảnh hướng dẫn chụp ảnh thẻ"
              >
                <img
                  className="public-guide-image"
                  src="/huongdanchupanh.png"
                  alt="Hướng dẫn chụp ảnh thẻ đúng chuẩn"
                />
              </button>
            </section>
          </Col>

          <Col lg={7}>
            <section className="app-panel public-panel">
              <div className="public-heading">
                <span className="lookup-badge">Thông tin gửi ảnh</span>
                <h2 className="public-form-title">Điền thông tin yêu cầu</h2>
                <p>Tiệm sẽ dùng thông tin này để tạo đơn và liên hệ xác nhận với bạn.</p>
              </div>

              {message ? <Alert variant="success">{message} Cảm ơn bạn đã tin tưởng lựa chọn tiệm.</Alert> : null}
              {error ? <Alert variant="danger">{error}</Alert> : null}

              <Form onSubmit={submit}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="upload-name">
                      <Form.Label>Họ tên</Form.Label>
                      <Form.Control required name="ho_ten" value={form.ho_ten} onChange={update} autoComplete="name" />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="upload-phone">
                      <Form.Label>Số điện thoại</Form.Label>
                      <Form.Control required name="so_dien_thoai" value={form.so_dien_thoai} onChange={update} inputMode="tel" autoComplete="tel" placeholder="0901234567 hoặc +84901234567" isInvalid={!!errors.so_dien_thoai} />
                      <Form.Control.Feedback type="invalid">{errors.so_dien_thoai}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group controlId="upload-email">
                      <Form.Label>Email</Form.Label>
                      <Form.Control required type="email" name="email" value={form.email} onChange={update} autoComplete="email" isInvalid={!!errors.email} />
                      <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="upload-card-type">
                      <Form.Label>Loại thẻ</Form.Label>
                      <Form.Select required name="loai_the_id" value={form.loai_the_id} onChange={update}>
                        <option value="">Chọn loại thẻ</option>
                        {cards.map((card) => <option value={card.id} key={card.id}>{card.ten}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="upload-delivery-method">
                      <Form.Label>Hình thức giao</Form.Label>
                      <Form.Select name="hinh_thuc_giao" value={form.hinh_thuc_giao} onChange={update}>
                        <option value="lay_file_truc_tuyen">Chỉ lấy file trực tuyến</option>
                        <option value="hen_lay_hinh">Hẹn lấy hình in</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  {!isOnlineFileDelivery ? (
                    <Col md={6}>
                      <Form.Group controlId="upload-quantity">
                        <Form.Label>Số lượng</Form.Label>
                        <Form.Control required min="4" type="number" name="so_luong" value={form.so_luong} onChange={update} />
                      </Form.Group>
                    </Col>
                  ) : (
                    <Col md={6}>
                      {hasOnlineFilePrice ? (
                        <Form.Group controlId="upload-online-file-price">
                          <Form.Label>Giá file trực tuyến</Form.Label>
                          <div className="online-file-price">
                            <span>Giá trọn gói mỗi đơn</span>
                            <strong>{formatCurrency(onlineFilePrice)}</strong>
                          </div>
                          <Form.Text>Không tính theo số lượng.</Form.Text>
                        </Form.Group>
                      ) : (
                        <Form.Group controlId="upload-online-file-price">
                          <Form.Label>Giá file trực tuyến</Form.Label>
                          <Alert variant="warning" className="mb-0">
                            Tiệm chưa cấu hình giá file trực tuyến. Vui lòng chọn hẹn lấy hình in hoặc liên hệ tiệm.
                          </Alert>
                        </Form.Group>
                      )}
                    </Col>
                  )}
                  <Col md={6}>
                    <Form.Group controlId="upload-files">
                      <Form.Label>Ảnh cần xử lý</Form.Label>
                      <Form.Control
                        required
                        disabled={!form.loai_the_id}
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        type="file"
                        onChange={handleFiles}
                      />
                      <Form.Text>{form.loai_the_id ? (files.length ? `${files.length} ảnh đã chọn` : 'JPEG, PNG hoặc WEBP') : 'Vui lòng chọn loại thẻ trước.'}</Form.Text>
                    </Form.Group>
                  </Col>
                  {files.length > 0 ? (
                    <Col xs={12}>
                      <div>
                        <div>
                          <strong>Kiểm tra chất lượng ảnh</strong>
                          <div className="small text-muted">Mỗi ảnh cần đạt tối thiểu {MIN_QC_SCORE_TO_SUBMIT} điểm để gửi yêu cầu.</div>
                        </div>
                      </div>
                      {qcError ? <Alert variant="warning" className="mt-3 mb-0">{qcError}</Alert> : null}
                      <div className="qc-photo-grid" aria-live="polite">
                        {files.map((item) => {
                          const result = qcResults[item.id];
                          const status = result ? qcStatusMeta[result.trang_thai_qc] : null;
                          const isChecking = qcCheckingIds.includes(item.id);
                          const score = Number(result?.diem_chat_luong);
                          const isBelowThreshold = Number.isFinite(score) && score < MIN_QC_SCORE_TO_SUBMIT;

                          return (
                            <article className="qc-photo-card" key={item.id}>
                              <div className="qc-photo-thumb">
                                <img src={item.previewUrl} alt={`Ảnh khách gửi: ${item.file.name}`} />
                                <button className="qc-photo-remove" type="button" onClick={() => removeFile(item.id)} aria-label={`Bỏ ảnh ${item.file.name}`}>
                                  <X size={13} aria-hidden="true" />
                                </button>
                              </div>
                              <div className="qc-photo-body">
                                <strong className="text-truncate" title={item.file.name}>{item.file.name}</strong>
                                <div className="qc-photo-verdict">
                                  {isChecking ? <span className="qc-photo-status">Đang kiểm tra...</span> : null}
                                  {!isChecking && status ? <Badge bg={status.variant} text={status.variant === 'warning' ? 'dark' : undefined}>{status.label}</Badge> : null}
                                  {!isChecking && !status ? <span className="qc-photo-status">Chưa kiểm tra</span> : null}
                                  {result?.diem_chat_luong != null ? <span className="qc-photo-score">Điểm {Math.round(score)}/100</span> : null}
                                </div>
                                {isBelowThreshold ? <div className="text-danger small">Chưa đạt {MIN_QC_SCORE_TO_SUBMIT} điểm, hãy thay hoặc bỏ ảnh này.</div> : null}
                                {result?.loi_chat_luong?.length ? (
                                  <ul className="qc-photo-issues">
                                    {result.loi_chat_luong.map((issue, index) => <li className={issue.severity === 'fail' ? 'text-danger' : 'text-warning-emphasis'} key={`${issue.code || 'issue'}-${index}`}>{issue.message}</li>)}
                                  </ul>
                                ) : result ? <div className="qc-photo-ok">Ảnh đạt yêu cầu cơ bản.</div> : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </Col>
                  ) : null}
                  {form.hinh_thuc_giao === 'hen_lay_hinh' ? (
                    <>
                      <Col md={6}>
                        <Form.Group controlId="upload-pickup-date">
                          <Form.Label>Ngày lấy hình</Form.Label>
                          <Form.Control required type="date" name="ngay_hen_lay" value={form.ngay_hen_lay} onChange={update} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group controlId="upload-pickup-slot">
                          <Form.Label>Khung giờ lấy</Form.Label>
                          <Form.Select required name="khung_gio_lay" value={form.khung_gio_lay} onChange={update}>
                            <option value="">Chọn giờ</option>
                            {pickupSlots.map((slot) => <option key={slot}>{slot}</option>)}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </>
                  ) : null}

                  {form.hinh_thuc_giao === 'hen_lay_hinh' ? (
                    <Col xs={12}>
                      <Alert variant="info" className="mb-0">
                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <div>
                            <div className="fs-6 font-weight-bold">Ước tính chi phí đơn</div>
                            <Form.Text className="text-muted">
                              Giá tạm tính theo loại thẻ và số lượng đã chọn.
                            </Form.Text>
                          </div>

                          <strong>
                            {estimatedPrintTotal != null
                              ? formatCurrency(estimatedPrintTotal)
                              : 'Chưa có giá áp dụng'}
                          </strong>
                        </div>
                      </Alert>
                    </Col>
                  ) : null}

                  <Col xs={12}>
                    <Form.Group controlId="upload-note">
                      <Form.Label>Ghi chú</Form.Label>
                      <Form.Control as="textarea" rows={3} name="ghi_chu" value={form.ghi_chu} onChange={update} />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="lookup-form-actions mt-3">
                  <Button type="submit" disabled={busy || !canSubmitPhotos || (isOnlineFileDelivery && !hasOnlineFilePrice)}>
                    <ImageUp size={17} aria-hidden="true" />
                    {busy ? 'Đang gửi...' : qcCheckingIds.length > 0 ? 'Đang kiểm tra QC...' : canSubmitPhotos ? 'Gửi yêu cầu xử lý ảnh' : `Cần ảnh QC từ ${MIN_QC_SCORE_TO_SUBMIT} điểm`}
                  </Button>
                </div>
              </Form>
            </section>
          </Col>
        </Row>
      </Container>
      <Modal show={showGuide} onHide={() => setShowGuide(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Hướng dẫn chụp ảnh</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <img className="public-guide-modal-image" src="/huongdanchupanh.png" alt="Hướng dẫn chụp ảnh thẻ đúng chuẩn" />
        </Modal.Body>
      </Modal>
      <PublicFooter />
    </div>
  );
}
