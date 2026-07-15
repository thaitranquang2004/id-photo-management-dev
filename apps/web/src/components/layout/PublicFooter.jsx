import { Container } from 'react-bootstrap';

// lucide-react không còn export icon thương hiệu -> dùng SVG Facebook nội tuyến.
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

// Footer cho các trang khách (public). Thông tin tiệm là placeholder — chủ tiệm tự sửa.
export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <Container>
        <div className="public-footer-inner">
          <div className="public-footer-info">
            <div className="public-footer-brand">
              <div className="brand-mark mb-2"><span className="brand-dot" /><span>Tiệm chụp hình 42A</span></div>
              <p>Chuyên chụp &amp; in ảnh thẻ - Ảnh hồ sơ lấy ngay - Xử lý ảnh đúng chuẩn quy định.</p>
            </div>
            <div>
              <h5>Liên hệ</h5>
              <p>
                Địa chỉ: 34D1 Đ. Nguyễn Văn Tư, Vĩnh Long<br />
                Điện thoại: 0362062993<br />
              </p>
              <a
                className="public-footer-social"
                href="https://www.facebook.com/profile.php?id=100076251571349"
                target="_blank"
                rel="noreferrer noopener"
                style={{ marginTop: '35px' }}
              >
                <FacebookIcon />
                <span>Facebook</span>
              </a>
            </div>
            <div>
              <h5>Giờ mở cửa</h5>
              <p>
                Thứ 2 – Thứ 7: 8:00 – 18:00<br />
                Chủ nhật: 12:00 – 18:00
              </p>
            </div>
          </div>

          <div className="public-footer-map">
            <iframe
              title="Bản đồ đường đến tiệm hình thẻ"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d245.39796708516025!2d106.36040470657815!3d10.231917344999406!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x310aa9c394440233%3A0xc6fe5e408d7f3412!2zVGnhu4dtIGNo4bulcCBow6xuaCA0MmE!5e0!3m2!1sen!2s!4v1783042398527!5m2!1sen!2s"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </Container>
    </footer>
  );
}
