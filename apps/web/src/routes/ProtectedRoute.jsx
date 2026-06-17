import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingState from '../components/feedback/LoadingState.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

export default function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Đang kiểm tra phiên đăng nhập..." fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
