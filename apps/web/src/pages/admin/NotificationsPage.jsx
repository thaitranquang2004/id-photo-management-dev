import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Form, Table } from 'react-bootstrap';
import { listNotifications } from '../../api/notifications';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import PaginationBar from '../../components/common/Pagination.jsx';
import { formatDate } from '../../utils/format';

const PAGE_SIZE = 20;

const EVENT_LABEL = {
  online_request_received: 'Nhận yêu cầu online',
  photos_ready: 'Ảnh sẵn sàng',
  order_delivered: 'Đã giao đơn'
};

const STATUS_META = {
  sent: { label: 'Đã gửi', bg: 'success' },
  simulated: { label: 'Mô phỏng', bg: 'info', text: 'dark' },
  failed: { label: 'Thất bại', bg: 'danger' },
  pending: { label: 'Đang gửi', bg: 'secondary' }
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: 'light', text: 'dark' };
  return <Badge bg={meta.bg} text={meta.text}>{meta.label}</Badge>;
}

export default function NotificationsPage() {
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['notifications', channel, page],
    queryFn: () => listNotifications({ channel: channel || undefined, page, limit: PAGE_SIZE })
  });

  const notifications = listQuery.data?.notifications || [];
  const totalPages = Math.ceil((listQuery.data?.total || 0) / PAGE_SIZE);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Thông báo</h1>
          <p>Nhật ký email (thật) và Zalo (mô phỏng) gửi cho khách.</p>
        </div>
        <Form.Select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
          <option value="">Tất cả kênh</option>
          <option value="email">Email</option>
          <option value="zalo">Zalo (mô phỏng)</option>
        </Form.Select>
      </div>

      <section className="app-panel">
        {listQuery.isLoading ? <LoadingState label="Đang tải thông báo..." /> : null}
        {listQuery.error ? <ErrorState error={listQuery.error} onRetry={listQuery.refetch} /> : null}
        {!listQuery.isLoading && !listQuery.error && notifications.length === 0 ? (
          <EmptyState title="Chưa có thông báo" description="Thông báo sẽ xuất hiện khi có yêu cầu online hoặc đơn chuyển trạng thái." />
        ) : null}
        {notifications.length > 0 ? (
          <div className="table-responsive">
            <Table hover className="align-middle data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Kênh</th>
                  <th>Sự kiện</th>
                  <th>Người nhận</th>
                  <th>Trạng thái</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((item) => (
                  <tr key={item.id}>
                    <td className="text-nowrap">{formatDate(item.created_at)}</td>
                    <td>
                      <Badge bg={item.channel === 'email' ? 'primary' : 'warning'} text={item.channel === 'email' ? undefined : 'dark'}>
                        {item.channel === 'email' ? 'Email' : 'Zalo'}
                      </Badge>
                    </td>
                    <td>{EVENT_LABEL[item.event_type] || item.event_type}</td>
                    <td>{item.recipient}</td>
                    <td>
                      <StatusBadge status={item.status} />
                      {item.error_message ? <div className="text-danger small">{item.error_message}</div> : null}
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      <div className="fw-semibold small">{item.subject}</div>
                      <div className="text-muted small" style={{ whiteSpace: 'pre-line' }}>{item.body}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
        <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </div>
  );
}
