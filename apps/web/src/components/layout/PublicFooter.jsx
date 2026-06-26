import { Container } from 'react-bootstrap';

// Footer cho các trang khách (public). Thông tin tiệm là placeholder — chủ tiệm tự sửa.
export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <Container>
        <div className="public-footer-grid">
          <div>
            <div className="brand-mark mb-2"><span className="brand-dot" /><span>Tiệm hình thẻ</span></div>
            <p>Chuyên chụp & in ảnh thẻ, ảnh hồ sơ lấy ngay; xử lý ảnh đúng chuẩn quy định.</p>
          </div>
          <div>
            <h5>Liên hệ</h5>
            <p>
              Địa chỉ: 34d1 Đ. Nguyễn Văn Tư, Bến Tre, Vĩnh Long, Vietnam<br />
              Điện thoại: 0362062993<br />
              Email: tiemhinhthe@example.com
            </p>
          </div>
          <div>
            <h5>Giờ mở cửa</h5>
            <p>
              Thứ 2 – Thứ 7: 8:00 – 18:00<br />
              Chủ nhật: 12:00 – 18:00
            </p>
          </div>
          <div>
            <h5>Liên kết nhanh</h5>
            <ul className="public-footer-links">
              <li><a href="/dat-lich">Đặt lịch online</a></li>
              <li><a href="/tra-cuu">Tra cứu đơn</a></li>
              <li><a href="/trang-thai">Trạng thái yêu cầu</a></li>
            </ul>
          </div>
        </div>
        <div className="public-footer-bottom">
          © {new Date().getFullYear()} Tiệm hình thẻ
        </div>
      </Container>
    </footer>
  );
}
