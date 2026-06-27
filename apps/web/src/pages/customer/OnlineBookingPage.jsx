import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Send, Upload } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { getPublicCardTypes } from '../../api/public';
import { submitOnlineRequest } from '../../api/intake';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { TIME_SLOTS } from '../../utils/constants.js';

const EMPTY_FORM = {
  ho_ten: '',
  so_dien_thoai: '',
  email: '',
  loai_the_id: '',
  loai_yeu_cau: 'both',
  ghi_chu: '',
  ngay_hen: '',
  khung_gio: ''
};

export default function OnlineBookingPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const { errors, clearError, validate } = useFormErrors();

  const cardTypesQuery = useQuery({
    queryKey: ['public-card-types'],
    queryFn: getPublicCardTypes
  });

  const submitMutation = useMutation({
    mutationFn: () => submitOnlineRequest({ fields: form, files }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setFiles([]);
    }
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const wantsUpload = form.loai_yeu_cau === 'upload' || form.loai_yeu_cau === 'both';
  const wantsBooking = form.loai_yeu_cau === 'booking' || form.loai_yeu_cau === 'both';

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  }

  function submit(event) {
    event.preventDefault();
    const rules = {
      ho_ten: 'Vui lòng nhập họ tên',
      so_dien_thoai: 'Vui lòng nhập số điện thoại'
    };
    if (wantsBooking) {
      rules.ngay_hen = 'Vui lòng chọn ngày hẹn';
      rules.khung_gio = 'Vui lòng chọn khung giờ';
    }
    if (!validate(form, rules)) return;
    submitMutation.mutate();
  }

  const submitted = submitMutation.data;

  return (
    <div className="public-page">
      <Container>
        <div className="public-topbar">
          <div className="brand-mark">
            <span className="brand-dot" />
            <span>Tiệm hình thẻ</span>
          </div>
          <div className="d-flex gap-2">
            <Button as="a" href="/tra-cuu" variant="outline-secondary" size="sm">Tra cứu đơn</Button>
            <Button as="a" href="/login" variant="outline-primary" size="sm">Staff/Admin</Button>
          </div>
        </div>

        <Row className="g-4 align-items-start">
          <Col lg={5}>
            <section className="app-panel public-panel">
              <div className="public-heading">
                <span className="lookup-badge">Đặt online</span>
                <h1>Đặt lịch & gửi ảnh online</h1>
                <p>Chọn loại ảnh, gửi ảnh gốc để xử lý từ xa và/hoặc đặt lịch đến tiệm chụp. Nhân viên sẽ liên hệ xác nhận.</p>
              </div>
              <div className="lookup-tips" aria-label="Quy trình đặt online">
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Upload size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Gửi ảnh từ xa</strong>
                    <span>Tải ảnh gốc để tiệm xử lý nền/độ sáng theo chuẩn ảnh thẻ.</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><CalendarClock size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Hoặc đặt lịch đến chụp</strong>
                    <span>Chọn ngày và khung giờ mong muốn, tiệm xác nhận lại.</span>
                  </div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><CheckCircle2 size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>Theo dõi đơn</strong>
                    <span>Khi đơn sẵn sàng, tra cứu bằng SĐT + mã đơn ở trang Tra cứu.</span>
                  </div>
                </div>
              </div>
            </section>
          </Col>

          <Col lg={7}>
            <section className="app-panel public-panel">
              {submitted ? (
                <Alert variant="success">
                  <Alert.Heading>Đã gửi yêu cầu!</Alert.Heading>
                  <p className="mb-1">Mã yêu cầu của bạn: <strong>{submitted.ma_yeu_cau}</strong></p>
                  <p className="mb-1">
                    Theo dõi tình trạng tại <a href="/trang-thai">Trạng thái yêu cầu</a> (dùng mã yêu cầu + số điện thoại).
                  </p>
                  <p className="mb-0">
                    Khi đơn hoàn tất, bạn có thể <a href="/tra-cuu">tra cứu đơn</a> bằng số điện thoại và mã đơn.
                  </p>
                  <hr />
                  <Button variant="outline-success" size="sm" onClick={() => submitMutation.reset()}>
                    Gửi yêu cầu khác
                  </Button>
                </Alert>
              ) : (
                <Form onSubmit={submit}>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Họ tên *</Form.Label>
                        <Form.Control value={form.ho_ten} onChange={(e) => update('ho_ten', e.target.value)} isInvalid={!!errors.ho_ten} />
                        <Form.Control.Feedback type="invalid">{errors.ho_ten}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Số điện thoại *</Form.Label>
                        <Form.Control value={form.so_dien_thoai} onChange={(e) => update('so_dien_thoai', e.target.value)} inputMode="tel" isInvalid={!!errors.so_dien_thoai} />
                        <Form.Control.Feedback type="invalid">{errors.so_dien_thoai}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Email (để nhận thông báo)</Form.Label>
                        <Form.Control type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Loại ảnh</Form.Label>
                        <Form.Select value={form.loai_the_id} onChange={(e) => update('loai_the_id', e.target.value)}>
                          <option value="">-- Chọn loại ảnh --</option>
                          {cardTypes.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.ten} ({ct.rong_mm}x{ct.cao_mm}mm)
                            </option>
                          ))}
                        </Form.Select>
                        {cardTypesQuery.isLoading ? <Form.Text>Đang tải loại ảnh...</Form.Text> : null}
                      </Form.Group>
                    </Col>
                    <Col xs={12}>
                      <Form.Label>Hình thức</Form.Label>
                      <div className="d-flex gap-3 flex-wrap">
                        <Form.Check
                          type="radio"
                          name="loai_yeu_cau"
                          id="rt-both"
                          label="Gửi ảnh + Đặt lịch"
                          checked={form.loai_yeu_cau === 'both'}
                          onChange={() => update('loai_yeu_cau', 'both')}
                        />
                        <Form.Check
                          type="radio"
                          name="loai_yeu_cau"
                          id="rt-upload"
                          label="Chỉ gửi ảnh"
                          checked={form.loai_yeu_cau === 'upload'}
                          onChange={() => update('loai_yeu_cau', 'upload')}
                        />
                        <Form.Check
                          type="radio"
                          name="loai_yeu_cau"
                          id="rt-booking"
                          label="Chỉ đặt lịch"
                          checked={form.loai_yeu_cau === 'booking'}
                          onChange={() => update('loai_yeu_cau', 'booking')}
                        />
                      </div>
                    </Col>

                    {wantsUpload ? (
                      <Col xs={12}>
                        <Form.Group>
                          <Form.Label>Ảnh gốc (có thể chọn nhiều)</Form.Label>
                          <Form.Control
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => setFiles(Array.from(e.target.files || []))}
                          />
                          {files.length > 0 ? <Form.Text>Đã chọn {files.length} ảnh</Form.Text> : null}
                        </Form.Group>
                      </Col>
                    ) : null}

                    {wantsBooking ? (
                      <>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Ngày hẹn *</Form.Label>
                            <Form.Control
                              type="date"
                              value={form.ngay_hen}
                              onChange={(e) => update('ngay_hen', e.target.value)}
                              isInvalid={!!errors.ngay_hen}
                            />
                            <Form.Control.Feedback type="invalid">{errors.ngay_hen}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Khung giờ *</Form.Label>
                            <Form.Select value={form.khung_gio} onChange={(e) => update('khung_gio', e.target.value)} isInvalid={!!errors.khung_gio}>
                              <option value="">-- Chọn khung giờ --</option>
                              {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">{errors.khung_gio}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </>
                    ) : null}

                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label>Ghi chú</Form.Label>
                        <Form.Control as="textarea" rows={2} value={form.ghi_chu} onChange={(e) => update('ghi_chu', e.target.value)} />
                      </Form.Group>
                    </Col>
                  </Row>

                  {submitMutation.error ? <Alert variant="danger" className="mt-3">{submitMutation.error.message}</Alert> : null}

                  <Button type="submit" className="mt-3" disabled={submitMutation.isPending}>
                    <Send size={17} aria-hidden="true" />
                    {submitMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
                  </Button>
                </Form>
              )}
            </section>
          </Col>
        </Row>
      </Container>
      <PublicFooter />
    </div>
  );
}
