import { NavLink } from 'react-router-dom';
import { CalendarPlus, ImageUp, LogIn, Search } from 'lucide-react';

const navItems = [
  { to: '/tra-cuu', label: 'Tra cứu đơn', icon: Search },
  { to: '/dat-lich', label: 'Đặt lịch chụp', icon: CalendarPlus },
  { to: '/gui-anh', label: 'Gửi ảnh', icon: ImageUp }
];

// Thanh điều hướng dùng chung cho các trang khách. Trang hiện tại được tô sáng
// (NavLink active) thay vì ẩn đi, để khách dễ nhận biết mình đang ở đâu.
export default function PublicTopbar() {
  return (
    <div className="public-topbar">
      <div className="brand-mark">
        <span className="brand-dot" />
        <span>Tiệm chụp hình 42A</span>
      </div>
      <nav className="public-nav" aria-label="Điều hướng trang khách">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/login"
          className="public-nav-link public-nav-link-icon"
          title="Đăng nhập nhân viên / quản trị"
          aria-label="Đăng nhập nhân viên / quản trị"
        >
          <LogIn size={16} aria-hidden="true" />
        </NavLink>
      </nav>
    </div>
  );
}
