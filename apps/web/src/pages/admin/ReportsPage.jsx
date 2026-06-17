import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileDown } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Col, Form, Row, Table } from 'react-bootstrap';
import {
  createOrdersExport,
  downloadOrdersReportCsv,
  getOrdersReport,
  listCardTypes
} from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import { formatCurrency, formatDate } from '../../utils/format';

function reportTotals(rows) {
  const uniqueCustomers = new Set(rows.map((row) => row.customer_phone).filter(Boolean));
  return {
    orders: rows.length,
    revenue: rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    processedPhotos: '-',
    customers: uniqueCustomers.size
  };
}

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    card_type_id: '',
    staff_id: '',
    status: ''
  });

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', filters.date_from, filters.date_to],
    queryFn: () => getOrdersReport({
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined
    })
  });
  const cardTypesQuery = useQuery({ queryKey: ['card-types'], queryFn: listCardTypes });

  const csvMutation = useMutation({
    mutationFn: () => downloadOrdersReportCsv({
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined
    }),
    onSuccess: async (response) => {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'orders-report.csv';
      link.click();
      URL.revokeObjectURL(url);
    }
  });

  const exportMutation = useMutation({
    mutationFn: () => createOrdersExport(filters)
  });

  if (reportQuery.isLoading || cardTypesQuery.isLoading) return <LoadingState label="Đang tải báo cáo..." />;
  if (reportQuery.error) return <ErrorState error={reportQuery.error} onRetry={reportQuery.refetch} />;

  const orders = reportQuery.data?.orders || [];
  const totals = reportTotals(orders);
  const cardTypes = cardTypesQuery.data?.card_types || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Báo cáo đơn hàng</h1>
          <p>Lọc theo thời gian và xuất CSV phục vụ nghiệm thu/vận hành.</p>
        </div>
        <div className="header-actions">
          <Button variant="outline-primary" onClick={() => csvMutation.mutate()} disabled={csvMutation.isPending}>
            <Download size={17} aria-hidden="true" />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <FileDown size={17} aria-hidden="true" />
            Tạo export job
          </Button>
        </div>
      </div>

      <section className="app-panel">
        <Row className="g-3 align-items-end">
          <Col md={3}>
            <Form.Group>
              <Form.Label>Từ ngày</Form.Label>
              <Form.Control type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Đến ngày</Form.Label>
              <Form.Control type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Loại thẻ</Form.Label>
              <Form.Select value={filters.card_type_id} onChange={(event) => setFilters((current) => ({ ...current, card_type_id: event.target.value }))}>
                <option value="">Tất cả</option>
                {cardTypes.map((cardType) => <option key={cardType.id} value={cardType.id}>{cardType.name}</option>)}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Nhân viên</Form.Label>
              <Form.Control value={filters.staff_id} onChange={(event) => setFilters((current) => ({ ...current, staff_id: event.target.value }))} placeholder="User ID" />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Trạng thái</Form.Label>
              <Form.Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">Tất cả</option>
                <option value="pending">pending</option>
                <option value="processing">processing</option>
                <option value="completed">completed</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <div className="text-muted small mt-2">
          Backend report hiện áp dụng filter thời gian; các filter loại thẻ, nhân viên, trạng thái đã có UI để nối tiếp khi API bổ sung.
        </div>
      </section>

      {(csvMutation.error || exportMutation.error) ? (
        <Alert variant="danger">{(csvMutation.error || exportMutation.error).message}</Alert>
      ) : null}
      {exportMutation.data?.export_job ? (
        <Alert variant="info">Export job: {exportMutation.data.export_job.id} · {exportMutation.data.export_job.status}</Alert>
      ) : null}

      <Row className="g-3">
        <Col sm={6} xl={3}><div className="summary-box"><span>Tổng đơn</span><strong>{totals.orders}</strong></div></Col>
        <Col sm={6} xl={3}><div className="summary-box"><span>Tổng doanh thu</span><strong>{formatCurrency(totals.revenue)}</strong></div></Col>
        <Col sm={6} xl={3}><div className="summary-box"><span>Ảnh xử lý</span><strong>{totals.processedPhotos}</strong></div></Col>
        <Col sm={6} xl={3}><div className="summary-box"><span>Khách unique</span><strong>{totals.customers}</strong></div></Col>
      </Row>

      <section className="app-panel">
        {orders.length === 0 ? (
          <EmptyState title="Không có dữ liệu báo cáo" />
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách</th>
                  <th>Loại thẻ</th>
                  <th>Trạng thái</th>
                  <th>Số lượng</th>
                  <th>Doanh thu</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={`${order.order_code}-${order.created_at}`}>
                    <td className="fw-semibold">{order.order_code}</td>
                    <td>
                      <div>{order.customer_name}</div>
                      <div className="text-muted small">{order.customer_phone}</div>
                    </td>
                    <td>{order.card_type_name}</td>
                    <td><OrderStatusBadge status={order.status} /></td>
                    <td>{order.quantity}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>{formatDate(order.created_at)}</td>
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
