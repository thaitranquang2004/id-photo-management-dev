import { useEffect, useState } from 'react';
import { Alert, Button, Form, InputGroup } from 'react-bootstrap';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Camera, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { hasSupabaseConfig } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useFormErrors } from '../../hooks/useFormErrors.js';

function postLoginPath(role, from) {
  if (role === 'admin') {
    return from && from !== '/login' ? from : '/admin';
  }
  if (from?.startsWith('/staff')) {
    return from;
  }
  return '/staff';
}

export default function LoginPage() {
  const { login, loading, isAuthenticated, role } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { errors, clearError, validate } = useFormErrors();
  const [showPassword, setShowPassword] = useState(false);
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
    if (!validate(form, { email: 'Vui lòng nhập email', password: 'Vui lòng nhập mật khẩu' })) return;
    try {
      const backendUser = await login(form);
      navigate(postLoginPath(backendUser.role, from), { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Không đăng nhập được. Kiểm tra email/password và profile nội bộ.');
    }
  }

  return (
    <div className="login-screen">
      {/* Decorative gradient glow background balls */}
      <div className="login-glow-1" aria-hidden="true" />
      <div className="login-glow-2" aria-hidden="true" />

      <div className="login-container">
        <div className="login-card-wrapper">
          <div className="login-logo-area">
            <div className="login-logo-circle">
              <Camera size={26} className="text-primary" />
            </div>
            <h1>Tiệm hình thẻ</h1>
            <p>Hệ thống Quản lý &amp; Xử lý ảnh thông minh</p>
          </div>

          <div className="login-form-card">
            <div className="login-card-header">
              <h2>Đăng nhập vận hành</h2>
              <p>Nhân viên &amp; Quản trị viên sử dụng tài khoản nội bộ</p>
            </div>

            {!hasSupabaseConfig ? (
              <Alert variant="danger" className="text-start py-2 px-3 small">
                Thiếu cấu hình <code>VITE_SUPABASE_URL</code> hoặc <code>VITE_SUPABASE_ANON_KEY</code> trong env.
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="danger" className="text-start py-2 px-3 small">
                {error}
              </Alert>
            ) : null}

            <Form onSubmit={handleSubmit} className="text-start">
              <Form.Group className="mb-3" controlId="login-email">
                <Form.Label>Địa chỉ Email</Form.Label>
                <InputGroup className="login-input-group" hasValidation>
                  <InputGroup.Text className="login-input-icon">
                    <Mail size={18} />
                  </InputGroup.Text>
                  <Form.Control
                    type="email"
                    autoComplete="email"
                    placeholder="email@tiemhinhthe.com"
                    value={form.email}
                    onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); clearError('email'); }}
                    isInvalid={!!errors.email}
                  />
                  <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-4" controlId="login-password">
                <Form.Label>Mật khẩu</Form.Label>
                <InputGroup className="login-input-group" hasValidation>
                  <InputGroup.Text className="login-input-icon">
                    <Lock size={18} />
                  </InputGroup.Text>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(event) => { setForm((current) => ({ ...current, password: event.target.value })); clearError('password'); }}
                    isInvalid={!!errors.password}
                  />
                  <Button
                    type="button"
                    variant="link"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                  <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              <Button
                type="submit"
                variant="primary"
                className="w-100 py-2.5 login-submit-btn"
                disabled={!hasSupabaseConfig || loading}
              >
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </Button>
            </Form>
          </div>

          <div className="login-links-footer">
            <span className="text-muted">Bạn là khách hàng?</span>
            <Link to="/tra-cuu" className="customer-lookup-link">
              <span>Tra cứu đơn hàng</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
