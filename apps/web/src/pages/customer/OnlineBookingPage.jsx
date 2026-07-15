import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { datLichChup, getKhungGioChup } from '../../api/intake.js';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import PublicTopbar from '../../components/layout/PublicTopbar.jsx';

const today = new Date().toISOString().slice(0, 10);
export default function OnlineBookingPage() {
  const [form, setForm] = useState({ ten_khach: '', so_dien_thoai: '', email: '', ngay_hen: today, khung_gio: '', ghi_chu: '' });
  const [slots, setSlots] = useState([]); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { getKhungGioChup(form.ngay_hen).then((data) => setSlots(data.khung_gio || [])).catch((e) => setError(e.message)); }, [form.ngay_hen]);
  const update = (e) => setForm((old) => ({ ...old, [e.target.name]: e.target.value }));
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await datLichChup(form); setMessage('Đã gửi yêu cầu đặt lịch. Tiệm sẽ xác nhận qua email.'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="public-page"><Container><PublicTopbar /><Row className="justify-content-center"><Col xl={8}><section className="app-panel public-panel"><div className="public-heading"><span className="lookup-badge">Đặt lịch chụp</span><h1>Đặt lịch chụp tại tiệm</h1><p>Lịch chỉ được xác nhận sau khi nhân viên duyệt. Đơn hàng sẽ được tạo khi bạn đến tiệm.</p></div>
    {message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-danger">{error}</div>}
    <Form onSubmit={submit}><Row className="g-3"><Col md={6}><Form.Label>Họ tên</Form.Label><Form.Control required name="ten_khach" value={form.ten_khach} onChange={update}/></Col><Col md={6}><Form.Label>Số điện thoại</Form.Label><Form.Control required name="so_dien_thoai" value={form.so_dien_thoai} onChange={update}/></Col><Col xs={12}><Form.Label>Email nhận xác nhận</Form.Label><Form.Control required type="email" name="email" value={form.email} onChange={update}/></Col><Col md={6}><Form.Label>Ngày chụp</Form.Label><Form.Control required min={today} type="date" name="ngay_hen" value={form.ngay_hen} onChange={update}/></Col><Col md={6}><Form.Label>Khung giờ</Form.Label><Form.Select required name="khung_gio" value={form.khung_gio} onChange={update}><option value="">Chọn khung giờ</option>{slots.map((slot) => <option disabled={!slot.so_cho_con_lai} key={slot.id} value={slot.khung_gio}>{slot.khung_gio} — còn {slot.so_cho_con_lai} chỗ</option>)}</Form.Select></Col><Col xs={12}><Form.Label>Ghi chú</Form.Label><Form.Control as="textarea" rows={3} name="ghi_chu" value={form.ghi_chu} onChange={update}/></Col><Col xs={12} className="d-flex gap-2"><Button disabled={busy} type="submit">{busy ? 'Đang gửi…' : 'Gửi yêu cầu đặt lịch'}</Button><Button as={Link} variant="outline-secondary" to="/gui-anh">Gửi ảnh từ xa</Button></Col></Row></Form>
  </section></Col></Row></Container><PublicFooter /></div>;
}
