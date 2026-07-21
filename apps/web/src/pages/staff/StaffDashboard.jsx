import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { CalendarDays, ClipboardList, Plus } from 'lucide-react';
import { Badge, Button, Col, Row, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { listCustomers } from '../../api/customers';
import { listOrders } from '../../api/orders';
import { listAppointments } from '../../api/intake';
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

const APPOINTMENT_STATUS = {
  cho_xac_nhan: ['Chờ xác nhận', 'warning'],
  da_xac_nhan: ['Đã xác nhận', 'info'],
  da_xong: ['Đã xong', 'success'],
  tu_choi: ['Từ chối', 'danger'],
  da_huy: ['Đã huỷ', 'secondary']
};

function localDateValue(date = new Date()) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export default function StaffDashboard() {
  const today = useMemo(() => todayRange(), []);
  const appointmentDate = useMemo(() => localDateValue(), []);
  const pendingOrders = useQuery({
    queryKey: ['staff', 'orders', 'pending-today', today.date_from, today.date_to],
    queryFn: () => listOrders({ trang_thai: 'cho_xu_ly', date_from: today.date_from, date_to: today.date_to, limit: 20 })
  });
  const processingOrders = useQuery({
    queryKey: ['staff', 'orders', 'processing-today', today.date_from, today.date_to],
    queryFn: () => listOrders({ trang_thai: 'dang_xu_ly', date_from: today.date_from, date_to: today.date_to, limit: 20 })
  });
  const completedOrders = useQuery({
    queryKey: ['staff', 'orders', 'completed-today', today.date_from, today.date_to],
    queryFn: () => listOrders({ trang_thai: 'hoan_tat', date_from: today.date_from, date_to: today.date_to, limit: 1 })
  });
  const unpaidOrders = useQuery({
    queryKey: ['staff', 'orders', 'unpaid-today', today.date_from, today.date_to],
    queryFn: () => listOrders({
      chua_thanh_toan: true,
      date_from: today.date_from,
      date_to: today.date_to,
      limit: 20
    })
  });
  const monthlyCustomers = useQuery({
    queryKey: ['staff', 'customers', 'month'],
    queryFn: () => listCustomers({ limit: 100 })
  });
  const reprintRequests = useQuery({
    queryKey: ['staff', 'reprints', 'new'],
    queryFn: () => listReprintRequests({ limit: 5 })
  });
  const todayAppointments = useQuery({
    queryKey: ['staff', 'appointments', 'today', appointmentDate],
    // Không truyền thời điểm UTC cho cột DATE: dùng đúng ngày theo múi giờ của nhân viên,
    // và không lọc loai_lich để nhận cả Đặt lịch chụp lẫn Hẹn lấy hình.
    queryFn: () => listAppointments({ date_from: appointmentDate, date_to: appointmentDate, limit: 50 })
  });

  const loading = pendingOrders.isLoading || processingOrders.isLoading || completedOrders.isLoading || unpaidOrders.isLoading || monthlyCustomers.isLoading || reprintRequests.isLoading || todayAppointments.isLoading;
  const error = pendingOrders.error || processingOrders.error || completedOrders.error || unpaidOrders.error || monthlyCustomers.error || reprintRequests.error || todayAppointments.error;
  const pending = ordersFrom(pendingOrders.data);
  const processing = ordersFrom(processingOrders.data);
  const unpaid = ordersFrom(unpaidOrders.data);
  const activeOrders = Array.from(new Map([...processing, ...pending, ...unpaid].map((order) => [order.id, order])).values())
    .sort((first, second) => new Date(second.ngay_tao) - new Date(first.ngay_tao));
  const activeOrdersTotal = (processingOrders.data?.pagination?.total ?? processing.length)
    + (pendingOrders.data?.pagination?.total ?? pending.length);
  const completedTotal = completedOrders.data?.pagination?.total ?? ordersFrom(completedOrders.data).length;
  const customersThisMonth = (monthlyCustomers.data?.data?.customers || [])
    .filter((customer) => new Date(customer.ngay_tao) >= thisMonthStart()).length;
  const reprints = reprintRequests.data?.requests || [];
  const appointments = todayAppointments.data?.data?.appointments || [];
  const appointmentsTodayTotal = todayAppointments.data?.data?.total ?? appointments.length;
  const hasActiveOrders = activeOrders.length > 0;

  if (loading) return <LoadingState label="Đang tải dashboard staff..." />;
  if (error) return <ErrorState error={error} onRetry={() => { pendingOrders.refetch(); processingOrders.refetch(); completedOrders.refetch(); unpaidOrders.refetch(); monthlyCustomers.refetch(); reprintRequests.refetch(); todayAppointments.refetch(); }} />;

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
        <Col sm={6} xl={3}><KpiCard label="Đơn cần xử lý hôm nay" value={activeOrdersTotal} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Đơn hoàn thành hôm nay" value={completedTotal} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Lịch hẹn hôm nay" value={appointmentsTodayTotal} /></Col>
        <Col sm={6} xl={3}><KpiCard label="Khách mới tháng này" value={customersThisMonth} /></Col>
      </Row>

      <Row className={`g-3 ${hasActiveOrders ? 'align-items-start' : 'align-items-stretch'}`}>
        <Col xl={8} className={hasActiveOrders ? undefined : 'd-flex'}>
          <section className={`app-panel${hasActiveOrders ? '' : ' flex-grow-1'}`}>
            <div className="section-title">
              <h2>Đơn chờ, đang xử lý &amp; chưa thanh toán hôm nay</h2>
              <ClipboardList size={20} aria-hidden="true" />
            </div>
            {activeOrders.length === 0 ? (
              <EmptyState title="Không có đơn cần theo dõi hôm nay" description="Đơn chờ, đang xử lý và chưa thanh toán được tạo trong ngày sẽ hiển thị tại đây." />
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
                    {activeOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="fw-semibold">{order.ma_don}</td>
                        <td>
                          <div>{order.ten_khach_hang}</div>
                          <div className="text-muted small">{order.sdt_khach_hang}</div>
                        </td>
                        <td>{order.ten_loai_the}</td>
                        <td><OrderStatusBadge status={order.trang_thai} /></td>
                        <td><PaymentStatusBadge total={order.tong_tien} paid={order.da_thanh_toan} /></td>
                        <td>{formatDate(order.ngay_tao)}</td>
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
        <Col xl={4} className="d-grid gap-3 align-content-start">
          <section className="app-panel">
            <div className="section-title">
              <h2>Lịch hẹn hôm nay</h2>
              <CalendarDays size={20} aria-hidden="true" />
            </div>
            {appointments.length === 0 ? (
              <EmptyState title="Chưa có lịch hẹn hôm nay" description="Lịch chụp và lịch lấy hình trong ngày sẽ hiển thị tại đây." />
            ) : (
              <div className="stack-list">
                {appointments.map((item) => {
                  const [statusLabel, statusVariant] = APPOINTMENT_STATUS[item.trang_thai] || [item.trang_thai, 'secondary'];
                  return (
                  <div className="stack-list-item" key={item.id}>
                    <div className="fw-semibold">{item.ho_ten} · {item.so_dien_thoai}</div>
                    <div className="text-muted small">{item.loai_lich === 'dat_lich_chup' ? 'Đặt lịch chụp' : 'Hẹn lấy hình'} · {item.khung_gio || 'Cả ngày'}</div>
                    <Badge bg={statusVariant} text={statusVariant === 'warning' ? 'dark' : undefined} className="mt-1">{statusLabel}</Badge>
                  </div>
                  );
                })}
              </div>
            )}
            <Button as={Link} to="/staff/appointments" size="sm" variant="outline-primary" className="mt-2">
              Mở lịch hẹn
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
                    <div className="fw-semibold">{item.ma_don || item.id}</div>
                    <div className="text-muted small">{item.ly_do || item.ghi_chu || 'Không có ghi chú'}</div>
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
