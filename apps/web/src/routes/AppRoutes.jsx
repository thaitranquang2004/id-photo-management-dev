import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import CardTypesPage from '../pages/admin/CardTypesPage.jsx';
import NotificationsPage from '../pages/admin/NotificationsPage.jsx';
import PricingPage from '../pages/admin/PricingPage.jsx';
import ReportsPage from '../pages/admin/ReportsPage.jsx';
import UsersPage from '../pages/admin/UsersPage.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import PublicLookupPage from '../pages/customer/PublicLookupPage.jsx';
import OnlineBookingPage from '../pages/customer/OnlineBookingPage.jsx';
import OnlineRequestStatusPage from '../pages/customer/OnlineRequestStatusPage.jsx';
import AppointmentsPage from '../pages/staff/AppointmentsPage.jsx';
import CustomerDetailPage from '../pages/staff/CustomerDetailPage.jsx';
import NewOrderPage from '../pages/staff/NewOrderPage.jsx';
import OnlineInboxPage from '../pages/staff/OnlineInboxPage.jsx';
import OrderDetailPage from '../pages/staff/OrderDetailPage.jsx';
import ReprintRequestsPage from '../pages/staff/ReprintRequestsPage.jsx';
import StaffDashboard from '../pages/staff/StaffDashboard.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import RoleRoute from './RoleRoute.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tra-cuu" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/tra-cuu" element={<PublicLookupPage />} />
      <Route path="/dat-lich" element={<OnlineBookingPage />} />
      <Route path="/trang-thai" element={<OnlineRequestStatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<RoleRoute allowedRoles={['staff', 'admin']} />}>
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/staff/orders/new" element={<NewOrderPage />} />
            <Route path="/staff/orders/:id" element={<OrderDetailPage />} />
            <Route path="/staff/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/staff/inbox" element={<OnlineInboxPage />} />
            <Route path="/staff/appointments" element={<AppointmentsPage />} />
            <Route path="/staff/reprints" element={<ReprintRequestsPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/card-types" element={<CardTypesPage />} />
            <Route path="/admin/pricing" element={<PricingPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tra-cuu" replace />} />
    </Routes>
  );
}
