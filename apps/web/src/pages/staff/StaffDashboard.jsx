import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Inbox, Plus } from 'lucide-react';
import { Button, Col, Row, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { listCustomers } from '../../api/customers';
import { listOrders } from '../../api/orders';
import { listOnlineRequests } from '../../api/intake';
import { listReprintRequests } from '../../api/reprints';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import KpiCard from '../../components/layout/KpiCard.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import PaymentStatusBadge from '../../components/status/PaymentStatusBadge.jsx';
import { formatDate, thisMonthStart, todayRange } from '../../utils/format';

function ordersFrom(result) {
  return result?.data?.orders || [];
}

export default function StaffDashboard() {
  const today = todayRange();
  const pendingOrders = useQuery({
    queryKey: ['staff', 'orders', 'pending-today', today.date_from, today.date_to],
    queryFn: () => listOrders({ status: 'pending', date_from: today.date_from, date_to: today.date_to, limit: 20 })
  });
  const completedOrders = useQuery({
    queryKey: ['staff', 'orders', 'completed-today', today.date_from, today.date_to],
    queryFn: () => listOrders({ status: 'completed', date_from: today.date_from, date_to: today.date_to, limit: 1 })
  });
  const monthlyCustomers = useQuery({
    queryKey: ['staff', 'customers', 'month'],
    queryFn: () => listCustomers({ limit: 100 })
  });
  const reprintRequests = useQuery({
    queryKey: ['staff', 'reprints', 'new'],
    queryFn: () => listReprintRequests({ limit: 5 })
  });
  const onlineRequests = useQuery({
    queryKey: ['staff', 'online-requests', 'new'],
    queryFn: () => listOnlineRequests({ status: 'new', limit: 5 })
  });

  const loading = pendingOrders.isLoading || completedOrders.isLoading || monthlyCustomers.isLoading || reprintRequests.isLoading || onlineRequests.isLoading;
  const error = pendingOrders.error || completedOrders.error || monthlyCustomers.error || reprintRequests.error || onlineRequests.error;
  const pending = ordersFrom(pendingOrders.data);
  const completedTotal = completedOrders.data?.pagination?.total ?? ordersFrom(completedOrders.data).length;
  const customersThisMonth = (monthlyCustomers.data?.data?.customers || [])
    .filter((customer) => new Date(customer.created_at) >= thisMonthStart()).length;
  const reprints = reprintRequests.data?.requests || [];
  const newOnlineRequests = onlineRequests.data?.online_requests || [];
  const newOnlineCount = onlineRequests.data?.total ?? newOnlineRequests.length;

  if (loading) return <LoadingState label="Đang tải dashboard staff..." />;
  if (error) return <ErrorState error={error} onRetry={() => { pendingOrders.refetch(); completedOrders.refetch(); monthlyCustomers.refetch(); reprintRequests.refetch(); onlineRequests.refetch(); }} />;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Dashboard staff</h1>
          <p>Việc cần xử lý trong ngày và thao tác nhanh tại quầy.</p>
        </div>
        <Button as={Link} to="/staff/orders/new" size="lg" className="button-nowrap">
          <Plus size={18} aria-hidden="true" />
          Tạo đơn mới
        </Button>
      </div>

      <Row className="g-3">
        <Col sm={6} xl={3}><KpiCard label="Đơn chờ hôm nay" value={pendingOrders.data?.pagination?.total ?? pending.length} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Đơn hoàn thành hôm nay" value={completedTotal} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Yêu cầu online mới" value={newOnlineCount} hint="Khách đặt lịch / gửi ảnh online" /></Col>
        <Col sm={6} xl={3}><KpiCard label="Khách mới tháng này" value={customersThisMonth} /></Col>
      </Row>

      <Row className="g-3">
        <Col xl={8}>
          <section className="app-panel">
            <div className="section-title">
              <h2>Đơn chờ xử lý hôm nay</h2>
              <ClipboardList size={20} aria-hidden="true" />
            </div>
            {pending.length === 0 ? (
              <EmptyState title="Không có đơn chờ" description="Các đơn pending trong ngày sẽ hiển thị tại đây." />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách</th>
                      <th>Loại thẻ</th>
                      <th>Trạng thái</th>
                      <th>Thanh toán</th>
                      <th>Ngày tạo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((order) => (
                      <tr key={order.id}>
                        <td className="fw-semibold">{order.order_code}</td>
                        <td>
                          <div>{order.customer_name}</div>
                          <div className="text-muted small">{order.customer_phone}</div>
                        </td>
                        <td>{order.card_type_name}</td>
                        <td><OrderStatusBadge status={order.status} /></td>
                        <td><PaymentStatusBadge total={order.total_amount} paid={order.amount_paid} /></td>
                        <td>{formatDate(order.created_at)}</td>
                        <td className="text-end">
                          <Button as={Link} to={`/staff/orders/${order.id}`} size="sm" variant="outline-primary">
                            Mở đơn
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
            <div className="section-title">
              <h2>Yêu cầu online mới</h2>
              <Inbox size={20} aria-hidden="true" />
            </div>
            {newOnlineRequests.length === 0 ? (
              <EmptyState title="Chưa có yêu cầu online" description="Yêu cầu từ trang Đặt online sẽ xuất hiện ở đây." />
            ) : (
              <div className="stack-list">
                {newOnlineRequests.map((item) => (
                  <div className="stack-list-item" key={item.id}>
                    <div className="fw-semibold">{item.full_name} · {item.phone}</div>
                    <div className="text-muted small">{item.card_type_name || 'Chưa chọn loại'} · {item.photo_count || 0} ảnh</div>
                  </div>
                ))}
              </div>
            )}
            <Button as={Link} to="/staff/inbox" size="sm" variant="outline-primary" className="mt-2">
              Mở hộp thư online
            </Button>
          </section>

          <section className="app-panel">
            <div className="section-title">
              <h2>Yêu cầu in lại mới</h2>
            </div>
            {reprints.length === 0 ? (
              <EmptyState title="Chưa có yêu cầu in lại" description="Yêu cầu từ trang tra cứu sẽ xuất hiện ở đây nếu backend trả dữ liệu." />
            ) : (
              <div className="stack-list">
                {reprints.map((item) => (
                  <div className="stack-list-item" key={item.id}>
                    <div className="fw-semibold">{item.order_code || item.id}</div>
                    <div className="text-muted small">{item.reason || item.note || 'Không có ghi chú'}</div>
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
