import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, LayoutDashboard, LogOut, Search, Settings, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Dropdown,
  Form,
  InputGroup,
  Nav,
  Navbar
} from 'react-bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { searchCustomersByPhone } from '../../api/customers';
import { useAuth } from '../../hooks/useAuth.jsx';

export default function AppShell() {
  const { role, profile, logout } = useAuth();
  const [phone, setPhone] = useState('');
  const [searchError, setSearchError] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    await logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  function handleSearch(event) {
    event.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;
    searchMutation.mutate(trimmed);
  }

  return (
    <div className="app-shell">
      <Navbar expand="lg" className="app-navbar" sticky="top">
        <Container fluid>
          <Navbar.Brand as={Link} to={role === 'admin' ? '/admin' : '/staff'} className="brand-mark">
            <Camera size={24} aria-hidden="true" />
            <span>Tiệm hình thẻ</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto nav-main">
              <Nav.Link as={NavLink} to="/staff" end>
                <LayoutDashboard size={17} aria-hidden="true" />
                Staff
              </Nav.Link>
              <Nav.Link as={NavLink} to="/staff/orders/new">
                <UserRoundPlus size={17} aria-hidden="true" />
                Tạo đơn
              </Nav.Link>
              {role === 'admin' ? (
                <>
                  <Nav.Link as={NavLink} to="/admin" end>
                    <ShieldCheck size={17} aria-hidden="true" />
                    Admin
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/admin/card-types">
                    <Settings size={17} aria-hidden="true" />
                    Cấu hình
                  </Nav.Link>
                </>
              ) : null}
            </Nav>

            <Form className="global-search" onSubmit={handleSearch}>
              <InputGroup size="sm">
                <Form.Control
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Tìm khách bằng SĐT"
                  aria-label="Tìm khách bằng số điện thoại"
                />
                <Button
                  type="submit"
                  variant="outline-primary"
                  disabled={!phone.trim() || searchMutation.isPending}
                  aria-label="Tìm khách"
                >
                  <Search size={17} aria-hidden="true" />
                </Button>
              </InputGroup>
            </Form>

            <Dropdown align="end" className="ms-lg-3 mt-2 mt-lg-0">
              <Dropdown.Toggle variant="light" size="sm" className="account-toggle">
                {profile?.full_name || role || 'Tài khoản'}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Header>{role === 'admin' ? 'Admin' : 'Staff'}</Dropdown.Header>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" />
                  Đăng xuất
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {searchError ? (
        <Container fluid className="pt-3">
          <Alert variant="warning" dismissible onClose={() => setSearchError('')} className="mb-0">
            {searchError}
          </Alert>
        </Container>
      ) : null}

      <main className="app-main">
        <Container fluid>
          <Outlet />
        </Container>
      </main>
    </div>
  );
}
