import { CalendarPlus, Clock3, HeartHandshake, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { datLichChup, getKhungGioChup } from '../../api/intake.js';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import PublicTopbar from '../../components/layout/PublicTopbar.jsx';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { emailRule, vietnamesePhoneRule } from '../../utils/validation.js';

const today = new Date().toISOString().slice(0, 10);

export default function OnlineBookingPage() {
  const [form, setForm] = useState({
    ten_khach: '',
    so_dien_thoai: '',
    email: '',
    ngay_hen: today,
    khung_gio: '',
    ghi_chu: ''
  });
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, clearError, validate } = useFormErrors();

  useEffect(() => {
    getKhungGioChup(form.ngay_hen)
      .then((data) => {
        setSlots(data.khung_gio || []);
        setError('');
      })
      .catch((requestError) => setError(requestError.message));
  }, [form.ngay_hen]);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    clearError(event.target.name);
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate(form, {
      ten_khach: 'Vui lòng nhập họ tên',
      so_dien_thoai: vietnamesePhoneRule,
      email: emailRule,
      ngay_hen: 'Vui lòng chọn ngày chụp',
      khung_gio: 'Vui lòng chọn khung giờ'
    })) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await datLichChup(form);
      setMessage('Đã gửi yêu cầu đặt lịch. Tiệm sẽ xác nhận qua email.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-page">
      <Container>
        <PublicTopbar />

        <Row className="g-4 align-items-start">
          <Col lg={5}>
            <section className="app-panel public-panel">
              <div className="public-heading public-guide-heading">
                <span className="lookup-badge">Khách hàng</span>
                <h1>Đặt lịch chụp tại tiệm</h1>
                <p>Chọn ngày và khung giờ phù hợp. Lịch chỉ được xác nhận sau khi nhân viên duyệt.</p>
              </div>

              <div className="lookup-tips public-guide-tips" aria-label="Quy trình đặt lịch">
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><CalendarPlus size={16} aria-hidden="true" /></span>
                  <div><strong>1. Chọn lịch</strong><span>Chọn ngày và khung giờ còn chỗ.</span></div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Mail size={16} aria-hidden="true" /></span>
                  <div><strong>2. Chờ xác nhận</strong><span>Tiệm phản hồi lịch hẹn qua email.</span></div>
                </div>
                <div className="lookup-tip">
                  <span className="lookup-tip-icon"><Clock3 size={16} aria-hidden="true" /></span>
                  <div><strong>3. Đến tiệm chụp</strong><span>Đơn hàng được tạo khi bạn đến chụp.</span></div>
                </div>
              </div>
            </section>

            <section className="public-panel-support public-thanks-panel" aria-label="Lời cảm ơn">
              <span className="support-icon"><HeartHandshake size={20} aria-hidden="true" /></span>
              <div>
                <strong>Cảm ơn chân thành</strong>
                <span>Cảm ơn bạn đã tin tưởng lựa chọn tiệm. Chúng tôi luôn sẵn sàng hỗ trợ để bạn có trải nghiệm chụp ảnh nhanh chóng, thoải mái và đúng chuẩn.</span>
              </div>
            </section>
          </Col>

          <Col lg={7}>
            <section className="app-panel public-panel">
              <div className="public-heading booking-form-heading">
                <span className="lookup-badge">Thông tin lịch hẹn</span>
                <h2 className="public-form-title">Điền thông tin đặt lịch</h2>
              </div>

              {message ? <Alert variant="success">{message} Cảm ơn bạn đã tin tưởng lựa chọn tiệm.</Alert> : null}
              {error ? <Alert variant="danger">{error}</Alert> : null}

              <Form onSubmit={submit}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="booking-name">
                      <Form.Label>Họ tên</Form.Label>
                      <Form.Control required name="ten_khach" value={form.ten_khach} onChange={update} autoComplete="name" />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="booking-phone">
                      <Form.Label>Số điện thoại</Form.Label>
                      <Form.Control required name="so_dien_thoai" value={form.so_dien_thoai} onChange={update} inputMode="tel" autoComplete="tel" placeholder="0901234567 hoặc +84901234567" isInvalid={!!errors.so_dien_thoai} />
                      <Form.Control.Feedback type="invalid">{errors.so_dien_thoai}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group controlId="booking-email">
                      <Form.Label>Email nhận xác nhận</Form.Label>
                      <Form.Control required type="email" name="email" value={form.email} onChange={update} autoComplete="email" isInvalid={!!errors.email} />
                      <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="booking-date">
                      <Form.Label>Ngày chụp</Form.Label>
                      <Form.Control required min={today} type="date" name="ngay_hen" value={form.ngay_hen} onChange={update} />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="booking-slot">
                      <Form.Label>Khung giờ</Form.Label>
                      <Form.Select required name="khung_gio" value={form.khung_gio} onChange={update}>
                        <option value="">Chọn khung giờ</option>
                        {slots.map((slot) => (
                          <option disabled={!slot.so_cho_con_lai} key={slot.id} value={slot.khung_gio}>
                            {slot.khung_gio} — còn {slot.so_cho_con_lai} chỗ
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group controlId="booking-note">
                      <Form.Label>Ghi chú</Form.Label>
                      <Form.Control as="textarea" rows={2} name="ghi_chu" value={form.ghi_chu} onChange={update} />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="lookup-form-actions mt-3">
                  <Button type="submit" disabled={busy}>
                    <CalendarPlus size={17} aria-hidden="true" />
                    {busy ? 'Đang gửi...' : 'Gửi yêu cầu đặt lịch'}
                  </Button>
                </div>
              </Form>
            </section>
          </Col>
        </Row>
      </Container>
      <PublicFooter />
    </div>
  );
}
