import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { listOrders } from '../../api/orders';
import PaginationBar from '../../components/common/Pagination.jsx';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import PaymentStatusBadge from '../../components/status/PaymentStatusBadge.jsx';
import { formatDate } from '../../utils/format.js';

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const ordersQuery = useQuery({
    queryKey: ['staff', 'orders', 'all', page, status],
    queryFn: () => listOrders({ page, limit: PAGE_SIZE, trang_thai: status || undefined })
  });

  if (ordersQuery.isLoading) return <LoadingState label="Đang tải đơn hàng..." />;
  if (ordersQuery.error) return <ErrorState error={ordersQuery.error} onRetry={ordersQuery.refetch} />;

  const orders = ordersQuery.data?.data?.orders || [];
  const pagination = ordersQuery.data?.pagination;
  const totalPages = pagination?.total_pages || 0;

  function changeStatus(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Đơn hàng</h1>
          <p>Xem lại toàn bộ đơn hàng, trạng thái xử lý và thanh toán.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Form.Select value={status} onChange={(event) => changeStatus(event.target.value)} style={{ maxWidth: 210 }}>
            <option value="">Tất cả</option>
            <option value="cho_xu_ly">Chờ xử lý</option>
            <option value="dang_xu_ly">Đang xử lý</option>
            <option value="hoan_tat">Hoàn thành</option>
            <option value="da_giao">Đã giao</option>
            <option value="da_huy">Đã hủy</option>
          </Form.Select>
          
        </div>
      </div>

      <section className="app-panel">
        {orders.length === 0 ? (
          <EmptyState title="Chưa có đơn hàng phù hợp" />
        ) : (
          <>
            <div className="table-responsive">
              <Table hover className="align-middle data-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách</th>
                    <th>Loại thẻ</th>
                    <th>Hình thức giao</th>
                    <th>Trạng thái</th>
                    <th>Thanh toán</th>
                    <th>Ngày tạo</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="fw-semibold">{order.ma_don}</td>
                      <td>
                        <div>{order.ten_khach_hang}</div>
                        <div className="text-muted small">{order.sdt_khach_hang}</div>
                      </td>
                      <td>{order.ten_loai_the}</td>
                      <td>{deliveryLabel(order.hinh_thuc_giao)}</td>
                      <td><OrderStatusBadge status={order.trang_thai} /></td>
                      <td><PaymentStatusBadge total={order.tong_tien} paid={order.da_thanh_toan} /></td>
                      <td>{formatDate(order.ngay_tao)}</td>
                      <td className="text-end">
                        <Button as={Link} to={`/staff/orders/${order.id}`} size="sm" variant="outline-primary">Mở đơn</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}

function deliveryLabel(method) {
  const labels = {
    lay_hinh_ngay: 'Lấy hình ngay',
    hen_lay_hinh: 'Hẹn lấy hình',
    lay_file_truc_tuyen: 'Lấy file trực tuyến'
  };

  return labels[method] || '—';
}
