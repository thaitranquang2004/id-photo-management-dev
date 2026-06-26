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
  full_name: '',
  phone: '',
  email: '',
  card_type_id: '',
  request_type: 'both',
  note: '',
  preferred_date: '',
  time_slot: ''
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
  const wantsUpload = form.request_type === 'upload' || form.request_type === 'both';
  const wantsBooking = form.request_type === 'booking' || form.request_type === 'both';

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  }

  function submit(event) {
    event.preventDefault();
    const rules = {
      full_name: 'Vui lòng nhập họ tên',
      phone: 'Vui lòng nhập số điện thoại'
    };
    if (wantsBooking) {
      rules.preferred_date = 'Vui lòng chọn ngày hẹn';
      rules.time_slot = 'Vui lòng chọn khung giờ';
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
                  <p className="mb-1">Mã yêu cầu của bạn: <strong>{submitted.request_id}</strong></p>
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
                        <Form.Control value={form.full_name} onChange={(e) => update('full_name', e.target.value)} isInvalid={!!errors.full_name} />
                        <Form.Control.Feedback type="invalid">{errors.full_name}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Số điện thoại *</Form.Label>
                        <Form.Control value={form.phone} onChange={(e) => update('phone', e.target.value)} inputMode="tel" isInvalid={!!errors.phone} />
                        <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
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
                        <Form.Select value={form.card_type_id} onChange={(e) => update('card_type_id', e.target.value)}>
                          <option value="">-- Chọn loại ảnh --</option>
                          {cardTypes.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.name} ({ct.width_mm}x{ct.height_mm}mm)
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
                          name="request_type"
                          id="rt-both"
                          label="Gửi ảnh + Đặt lịch"
                          checked={form.request_type === 'both'}
                          onChange={() => update('request_type', 'both')}
                        />
                        <Form.Check
                          type="radio"
                          name="request_type"
                          id="rt-upload"
                          label="Chỉ gửi ảnh"
                          checked={form.request_type === 'upload'}
                          onChange={() => update('request_type', 'upload')}
                        />
                        <Form.Check
                          type="radio"
                          name="request_type"
                          id="rt-booking"
                          label="Chỉ đặt lịch"
                          checked={form.request_type === 'booking'}
                          onChange={() => update('request_type', 'booking')}
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
                              value={form.preferred_date}
                              onChange={(e) => update('preferred_date', e.target.value)}
                              isInvalid={!!errors.preferred_date}
                            />
                            <Form.Control.Feedback type="invalid">{errors.preferred_date}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Khung giờ *</Form.Label>
                            <Form.Select value={form.time_slot} onChange={(e) => update('time_slot', e.target.value)} isInvalid={!!errors.time_slot}>
                              <option value="">-- Chọn khung giờ --</option>
                              {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">{errors.time_slot}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </>
                    ) : null}

                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label>Ghi chú</Form.Label>
                        <Form.Control as="textarea" rows={2} value={form.note} onChange={(e) => update('note', e.target.value)} />
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
