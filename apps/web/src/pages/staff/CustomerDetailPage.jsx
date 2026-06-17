import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Col, Row, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { getCustomer, getCustomerPrintLayouts } from '../../api/customers';
import { getLayoutDownloadUrl } from '../../api/layouts';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import { formatDate } from '../../utils/format';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const customerQuery = useQuery({
    queryKey: ['customers', id],
    queryFn: () => getCustomer(id)
  });
  const layoutsQuery = useQuery({
    queryKey: ['customers', id, 'print-layouts'],
    queryFn: () => getCustomerPrintLayouts(id, { limit: 20 })
  });
  const downloadMutation = useMutation({
    mutationFn: getLayoutDownloadUrl,
    onSuccess: (result) => {
      const url = result.layout_signed_url || result.signed_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  });

  if (customerQuery.isLoading || layoutsQuery.isLoading) return <LoadingState label="Đang tải lịch sử khách..." />;
  if (customerQuery.error) return <ErrorState error={customerQuery.error} onRetry={customerQuery.refetch} />;
  if (layoutsQuery.error) return <ErrorState error={layoutsQuery.error} onRetry={layoutsQuery.refetch} />;

  const customer = customerQuery.data?.customer;
  const recentOrders = customerQuery.data?.recent_orders || [];
  const printLayouts = layoutsQuery.data?.data?.print_layouts || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>{customer?.full_name}</h1>
          <p>{customer?.phone} · {customer?.email || 'Chưa có email'}</p>
        </div>
        <Button as={Link} to="/staff/orders/new" variant="primary">Tạo đơn mới</Button>
      </div>

      <Row className="g-3">
        <Col lg={4}>
          <section className="app-panel">
            <h2>Thông tin khách</h2>
            <Table className="detail-table">
              <tbody>
                <tr><th>Họ tên</th><td>{customer?.full_name}</td></tr>
                <tr><th>SĐT</th><td>{customer?.phone}</td></tr>
                <tr><th>Email</th><td>{customer?.email || '-'}</td></tr>
                <tr><th>Ghi chú</th><td>{customer?.notes || '-'}</td></tr>
                <tr><th>Ngày tạo</th><td>{formatDate(customer?.created_at)}</td></tr>
              </tbody>
            </Table>
          </section>
        </Col>
        <Col lg={8}>
          <section className="app-panel">
            <h2>Đơn gần đây</h2>
            {recentOrders.length === 0 ? (
              <EmptyState title="Chưa có đơn cũ" />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Loại thẻ</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="fw-semibold">{order.order_code}</td>
                        <td>{order.card_type_name}</td>
                        <td><OrderStatusBadge status={order.status} /></td>
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
      </Row>

      <section className="app-panel">
        <h2>Layout cũ</h2>
        {printLayouts.length === 0 ? (
          <EmptyState title="Chưa có layout cũ" description="Layout generated của khách sẽ hiển thị tại đây." />
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Loại layout</th>
                  <th>Khổ giấy</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="text-end">Tải lại</th>
                </tr>
              </thead>
              <tbody>
                {printLayouts.map((layout) => (
                  <tr key={layout.id}>
                    <td>{layout.order_id}</td>
                    <td>{layout.layout_type}</td>
                    <td>{layout.paper_size}</td>
                    <td>{layout.status}</td>
                    <td>{formatDate(layout.created_at)}</td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={downloadMutation.isPending || layout.status !== 'generated'}
                        onClick={() => downloadMutation.mutate(layout.id)}
                      >
                        Tải signed URL
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
