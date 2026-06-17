import { Alert, Button, Container } from 'react-bootstrap';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function RoleRoute({ allowedRoles }) {
  const { role } = useAuth();

  if (!allowedRoles.includes(role)) {
    if (role === 'admin' && allowedRoles.includes('staff')) {
      return <Outlet />;
    }
    if (role === 'staff') {
      return (
        <Container className="py-5">
          <Alert variant="warning" className="app-panel">
            <Alert.Heading>Không có quyền truy cập</Alert.Heading>
            <p className="mb-3">Tài khoản staff không được phép vào khu vực admin.</p>
            <Button as={Link} to="/staff" variant="primary">Về dashboard staff</Button>
          </Alert>
        </Container>
      );
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
