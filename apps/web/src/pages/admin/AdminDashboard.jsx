import { useQuery } from '@tanstack/react-query';
import { Col, Row, Table, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { getAdminDashboard } from '../../api/admin';
import { listOrders } from '../../api/orders';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import KpiCard from '../../components/layout/KpiCard.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import { formatCurrency, formatDate } from '../../utils/format';

export default function AdminDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getAdminDashboard
  });
  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => listOrders({ limit: 10 })
  });
  const reprintsQuery = useQuery({
    queryKey: ['admin', 'reprints', 'new'],
    queryFn: () => apiRequest('/reprint-requests', { query: { limit: 5 } })
  });

  const loading = dashboardQuery.isLoading || ordersQuery.isLoading || reprintsQuery.isLoading;
  const error = dashboardQuery.error || ordersQuery.error || reprintsQuery.error;
  if (loading) return <LoadingState label="Đang tải dashboard admin..." />;
  if (error) return <ErrorState error={error} onRetry={() => { dashboardQuery.refetch(); ordersQuery.refetch(); }} />;

  const dashboard = dashboardQuery.data?.dashboard || {};
  const orders = ordersQuery.data?.data?.orders || [];
  const reprints = reprintsQuery.data?.data?.requests || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Dashboard admin</h1>
          <p>Tổng quan vận hành, doanh thu và các cấu hình cần theo dõi.</p>
        </div>
        <div className="header-actions">
          <Button as={Link} to="/admin/reports" variant="outline-primary">Báo cáo</Button>
          <Button as={Link} to="/admin/card-types" variant="primary">Cấu hình loại thẻ</Button>
        </div>
      </div>

      <Row className="g-3">
        <Col sm={6} xl={3}><KpiCard label="Tổng đơn" value={dashboard.orders_total ?? 0} hint="Backend dashboard hiện trả tổng số" /></Col>
        <Col sm={6} xl={3}><KpiCard label="Doanh thu hoàn thành" value={formatCurrency(dashboard.revenue_total || 0)} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Khách mới 30 ngày" value={dashboard.new_customers_30d ?? 0} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Ảnh đã xử lý" value={dashboard.processed_photos_total ?? 0} /></Col>
      </Row>

      <Row className="g-3">
        <Col xl={8}>
          <section className="app-panel">
            <h2>Đơn gần đây</h2>
            {orders.length === 0 ? (
              <EmptyState title="Chưa có đơn" />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách</th>
                      <th>Loại thẻ</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="fw-semibold">{order.order_code}</td>
                        <td>{order.customer_name}</td>
                        <td>{order.card_type_name}</td>
                        <td><OrderStatusBadge status={order.status} /></td>
                        <td>{formatDate(order.created_at)}</td>
                        <td className="text-end">
                          <Button as={Link} to={`/staff/orders/${order.id}`} size="sm" variant="outline-primary">
                            Mở
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        </Col>
        <Col xl={4}>
          <section className="app-panel">
            <h2>Yêu cầu in lại mới</h2>
            {reprints.length === 0 ? (
              <EmptyState title="Không có yêu cầu mới" />
            ) : (
              <div className="stack-list">
                {reprints.map((request) => (
                  <div className="stack-list-item" key={request.id}>
                    <strong>{request.order_code || request.id}</strong>
                    <span>{request.reason || request.note || 'Không có ghi chú'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Col>
      </Row>
    </div>
  );
}
