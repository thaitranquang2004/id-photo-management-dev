import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { hasSupabaseConfig } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth.jsx';

export default function LoginPage() {
  const { login, loading, isAuthenticated, role } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'admin' ? '/admin' : '/staff', { replace: true });
    }
  }, [isAuthenticated, navigate, role]);

  if (loading && !isAuthenticated) {
    return <LoadingState label="Đang kiểm tra phiên đăng nhập..." fullPage />;
  }

  if (isAuthenticated) {
    return <Navigate to={role === 'admin' ? '/admin' : '/staff'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      const backendUser = await login(form);
      const target = from && from !== '/login' ? from : backendUser.role === 'admin' ? '/admin' : '/staff';
      navigate(target, { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Không đăng nhập được. Kiểm tra email/password và profile nội bộ.');
    }
  }

  return (
    <div className="login-screen">
      <Container>
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={7} lg={5} xl={4}>
            <Card className="login-card">
              <Card.Body>
                <div className="login-title">
                  <span className="brand-dot" />
                  <div>
                    <h1>Đăng nhập vận hành</h1>
                    <p>Staff/Admin dùng tài khoản Supabase Auth.</p>
                  </div>
                </div>

                {!hasSupabaseConfig ? (
                  <Alert variant="danger">
                    Thiếu `VITE_SUPABASE_URL` hoặc `VITE_SUPABASE_ANON_KEY` trong env frontend.
                  </Alert>
                ) : null}

                {error ? <Alert variant="danger">{error}</Alert> : null}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="login-email">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-4" controlId="login-password">
                    <Form.Label>Mật khẩu</Form.Label>
                    <Form.Control
                      type="password"
                      autoComplete="current-password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      required
                    />
                  </Form.Group>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-100"
                    disabled={!hasSupabaseConfig || loading || !form.email || !form.password}
                  >
                    {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
            <div className="login-public-link">
              Khách hàng tra cứu đơn tại <a href="/tra-cuu">/tra-cuu</a>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
