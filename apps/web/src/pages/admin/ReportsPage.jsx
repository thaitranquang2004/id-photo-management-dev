import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Col, Form, Row, Table } from 'react-bootstrap';
import {
  getOrdersReport,
  listCardTypes
} from '../../api/admin';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import OrderStatusBadge from '../../components/status/OrderStatusBadge.jsx';
import { formatCurrency, formatDate } from '../../utils/format';

function reportTotals(rows) {
  const revenue = rows.reduce((sum, row) => sum + Number(row.tong_tien || 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.da_thanh_toan || 0), 0);
  return {
    orders: rows.length,
    revenue,
    paid,
    debt: revenue - paid
  };
}

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    loai_the_id: '',
    nguoi_tao: '',
    trang_thai: ''
  });

  const reportParams = {
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    loai_the_id: filters.loai_the_id || undefined,
    nguoi_tao: filters.nguoi_tao || undefined,
    trang_thai: filters.trang_thai || undefined
  };

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', reportParams],
    queryFn: () => getOrdersReport(reportParams)
  });
  const cardTypesQuery = useQuery({ queryKey: ['card-types'], queryFn: listCardTypes });

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
          <p>Lọc theo thời gian, loại thẻ, nhân viên, trạng thái phục vụ nghiệm thu/vận hành.</p>
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
              <Form.Select value={filters.loai_the_id} onChange={(event) => setFilters((current) => ({ ...current, loai_the_id: event.target.value }))}>
                <option value="">Tất cả</option>
                {cardTypes.map((cardType) => <option key={cardType.id} value={cardType.id}>{cardType.ten}</option>)}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Nhân viên</Form.Label>
              <Form.Control value={filters.nguoi_tao} onChange={(event) => setFilters((current) => ({ ...current, nguoi_tao: event.target.value }))} placeholder="User ID" />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Trạng thái</Form.Label>
              <Form.Select value={filters.trang_thai} onChange={(event) => setFilters((current) => ({ ...current, trang_thai: event.target.value }))}>
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
      </section>

      <Row className="g-3">
        <Col sm={6} xl={3}><div className="summary-box"><span>Tổng đơn</span><strong>{totals.orders}</strong></div></Col>
        <Col sm={6} xl={3}><div className="summary-box"><span>Tổng doanh thu</span><strong>{formatCurrency(totals.revenue)}</strong></div></Col>
        <Col sm={6} xl={3}><div className="summary-box"><span>Đã thu</span><strong>{formatCurrency(totals.paid)}</strong></div></Col>
        <Col sm={6} xl={3}><div className="summary-box"><span>Công nợ</span><strong>{formatCurrency(totals.debt)}</strong></div></Col>
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
                  <th>Nhân viên</th>
                  <th>Trạng thái</th>
                  <th>Số lượng</th>
                  <th>Doanh thu</th>
                  <th>Đã thu</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={`${order.ma_don}-${order.ngay_tao}`}>
                    <td className="fw-semibold">{order.ma_don}</td>
                    <td>
                      <div>{order.ten_khach_hang}</div>
                      <div className="text-muted small">{order.sdt_khach_hang}</div>
                    </td>
                    <td>{order.ten_loai_the}</td>
                    <td>{order.ten_nhan_vien || '—'}</td>
                    <td><OrderStatusBadge status={order.trang_thai} /></td>
                    <td>{order.so_luong}</td>
                    <td>{formatCurrency(order.tong_tien)}</td>
                    <td>{formatCurrency(order.da_thanh_toan)}</td>
                    <td>{formatDate(order.ngay_tao)}</td>
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
