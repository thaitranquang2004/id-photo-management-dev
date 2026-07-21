import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  UserRoundPlus,
  ChevronLeft
} from 'lucide-react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Dropdown,
  Form,
  InputGroup
} from 'react-bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { searchCustomersByPhone } from '../../api/customers';
import { listOnlineRequests, listAppointments } from '../../api/intake';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import ConfirmDialog from '../feedback/ConfirmDialog.jsx';

const staffNavItems = [
  { to: '/staff', end: true, label: 'Vận hành', icon: LayoutDashboard },
  { to: '/staff/orders/new', label: 'Tạo đơn', icon: UserRoundPlus },
  { to: '/staff/orders', end: true, label: 'Đơn hàng', icon: ClipboardList },
  { to: '/staff/online-requests', label: 'Yêu cầu online', icon: ClipboardList },
  { to: '/staff/appointments', label: 'Lịch hẹn', icon: CalendarClock },
  { to: '/staff/reprints', label: 'Yêu cầu in lại', icon: Printer }
];

const adminNavItems = [
  { to: '/admin', end: true, label: 'Admin', icon: ShieldCheck },
  { to: '/admin/card-types', label: 'Loại thẻ', icon: Settings },
  { to: '/admin/pricing', label: 'Giá', icon: Tags },
  { to: '/admin/khung-gio-chup', label: 'Khung giờ chụp', icon: CalendarClock },
  { to: '/admin/users', label: 'Nhân viên', icon: UserCog },
  { to: '/admin/notifications', label: 'Thông báo', icon: Bell },
  { to: '/admin/reports', label: 'Báo cáo', icon: BarChart3 }
];

export default function AppShell() {
  const { role, profile, logout } = useAuth();
  const [phone, setPhone] = useState('');
  const [searchError, setSearchError] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Chỉ lịch chụp và yêu cầu ảnh mới cần hiển thị nhắc việc.
  const newApptQuery = useQuery({
    queryKey: ['sidebar', 'appt-new'],
    queryFn: () => listAppointments({ trang_thai: 'cho_xac_nhan', loai_lich: 'dat_lich_chup', limit: 1 }),
    refetchInterval: 30000
  });
  const newOnlineRequestsQuery = useQuery({
    queryKey: ['sidebar', 'online-requests-new'],
    queryFn: () => listOnlineRequests({ trang_thai: 'moi', limit: 1 }),
    refetchInterval: 30000
  });
  const navDots = {
    '/staff/appointments': (newApptQuery.data?.total || 0) > 0,
    '/staff/online-requests': (newOnlineRequestsQuery.data?.total || 0) > 0
  };

  const searchMutation = useMutation({
    mutationFn: searchCustomersByPhone,
    onSuccess: (customers) => {
      setSearchError('');
      if (customers.length === 1) {
        navigate(`/staff/customers/${customers[0].id}`);
      } else if (customers.length > 1) {
        navigate(`/staff/customers/${customers[0].id}`);
        setSearchError(`Tìm thấy ${customers.length} khách. Đang mở khách mới nhất.`);
      } else {
        setSearchError('Không tìm thấy khách theo số điện thoại này.');
      }
    },
    onError: (error) => setSearchError(error.message)
  });

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      queryClient.clear();
      navigate('/login', { replace: true });
      toast.success('Đã đăng xuất');
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;
    searchMutation.mutate(trimmed);
  }

  return (
    <div className="app-shell">
      {/* Mobile Header */}
      <header className="mobile-header d-lg-none">
        <Button
          variant="light"
          className="mobile-toggle-btn"
          onClick={() => setShowSidebar(true)}
          aria-label="Mở menu"
        >
          <Menu size={20} />
        </Button>
        <Link to={role === 'admin' ? '/admin' : '/staff'} className="brand-mark">
          <span className="brand-dot" />
          <span>Tiệm hình thẻ</span>
        </Link>
        <Dropdown align="end">
          <Dropdown.Toggle variant="light" size="sm" className="account-toggle border-0 py-1">
            <ReceiptText size={16} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Header>{profile?.ho_ten || role}</Dropdown.Header>
            <Dropdown.Divider />
            <Dropdown.Item onClick={() => setShowLogoutConfirm(true)}>
              <LogOut size={16} />
              Đăng xuất
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </header>

      {/* Mobile Drawer Backdrop */}
      {showSidebar ? (
        <div className="sidebar-backdrop d-lg-none" onClick={() => setShowSidebar(false)} />
      ) : null}

      {/* Left Vertical Sidebar */}
      <aside className={`app-sidebar ${showSidebar ? 'show' : ''}`}>
        <div className="sidebar-header">
          <Link to={role === 'admin' ? '/admin' : '/staff'} className="brand-mark" onClick={() => setShowSidebar(false)}>
            <img className="sidebar-brand-logo" src="/favicon.svg" alt="Logo Tiệm hình thẻ" />
            <span>Tiệm hình thẻ 42A</span>
          </Link>
          <Button
            variant="link"
            className="sidebar-close-btn d-lg-none"
            onClick={() => setShowSidebar(false)}
            aria-label="Đóng menu"
          >
            <ChevronLeft size={22} />
          </Button>
        </div>

        {/* Global Search integrated in Sidebar */}
        <div className="sidebar-search">
          <Form onSubmit={handleSearch}>
            <InputGroup size="sm">
              <Form.Control
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Tìm khách bằng SĐT..."
                aria-label="Tìm khách bằng số điện thoại"
              />
              <Button
                type="submit"
                variant="outline-primary"
                disabled={!phone.trim() || searchMutation.isPending}
                aria-label="Tìm khách"
              >
                <Search size={16} aria-hidden="true" />
              </Button>
            </InputGroup>
          </Form>
        </div>

        {/* Navigation Section */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Vận hành</div>
          {staffNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                onClick={() => setShowSidebar(false)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {navDots[item.to] ? <span className="nav-dot" aria-label="Có mục mới" /> : null}
              </NavLink>
            );
          })}

          {role === 'admin' ? (
            <>
              <div className="nav-section-title mt-4">Quản trị</div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
                    onClick={() => setShowSidebar(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </>
          ) : null}
        </nav>

        {/* Sidebar Profile & Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {(profile?.ho_ten || role || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{profile?.ho_ten || role || 'Tài khoản'}</span>
              <span className="user-role">{role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</span>
            </div>
          </div>
          <Button
            variant="outline-danger"
            size="sm"
            className="w-100 logout-btn mt-3"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Đăng xuất</span>
          </Button>
        </div>
      </aside>

      {/* Right Content Area */}
      <div className="app-main-content">
        {searchError ? (
          <Container fluid className="pt-3 px-4">
            <Alert variant="warning" dismissible onClose={() => setSearchError('')} className="mb-0">
              {searchError}
            </Alert>
          </Container>
        ) : null}

        <main className="app-content-body">
          <Container fluid className="px-4">
            <Outlet />
          </Container>
        </main>
      </div>

      <ConfirmDialog
        show={showLogoutConfirm}
        title="Đăng xuất"
        message="Bạn có chắc muốn đăng xuất khỏi tài khoản?"
        confirmLabel="Đăng xuất"
        cancelLabel="Huỷ"
        variant="danger"
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
