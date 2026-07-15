import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Table } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { listAppointments, updateAppointmentStatus } from '../../api/intake.js';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import { formatDateOnly } from '../../utils/format.js';

const labels = { cho_xac_nhan: ['Chờ xác nhận', 'warning'], da_xac_nhan: ['Đã xác nhận', 'info'], tu_choi: ['Từ chối', 'danger'], da_xong: ['Đã xong', 'success'], da_huy: ['Đã huỷ', 'secondary'] };
export default function AppointmentsPage() {
  const client = useQueryClient(); const navigate = useNavigate();
  const query = useQuery({ queryKey: ['appointments'], queryFn: () => listAppointments({ limit: 100 }) });
  const mutation = useMutation({ mutationFn: ({ id, trang_thai }) => updateAppointmentStatus(id, { trang_thai }), onSuccess: () => client.invalidateQueries({ queryKey: ['appointments'] }) });
  const rows = query.data?.appointments || [];
  return <div className="page-stack"><div className="page-header"><div><h1>Lịch chụp và lịch lấy hình</h1><p>Lịch chụp chỉ tạo đơn khi khách đến tiệm; lịch lấy hình không chiếm chỗ chụp.</p></div></div><section className="app-panel">{query.isLoading && <LoadingState/>}{query.error && <ErrorState error={query.error}/>} {!query.isLoading && !query.error && !rows.length && <EmptyState title="Chưa có lịch hẹn"/>}{rows.length > 0 && <div className="table-responsive"><Table hover className="align-middle data-table"><thead><tr><th>Loại lịch</th><th>Khách</th><th>Thời gian</th><th>Đơn</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead><tbody>{rows.map((item) => { const meta = labels[item.trang_thai] || [item.trang_thai, 'secondary']; const studio = item.loai_lich === 'dat_lich_chup'; return <tr key={item.id}><td>{studio ? 'Đặt lịch chụp' : 'Hẹn lấy hình'}</td><td><strong>{item.ten_khach || '-'}</strong><br/><small>{item.so_dien_thoai}</small>{item.email && <><br/><small>{item.email}</small></>}</td><td>{formatDateOnly(item.ngay_hen)}<br/><small>{item.khung_gio}</small></td><td>{item.don_hang_id ? <Link to={`/staff/orders/${item.don_hang_id}`}>{item.ma_don || 'Mở đơn'}</Link> : '-'}</td><td><Badge bg={meta[1]}>{meta[0]}</Badge></td><td className="text-end">{studio && item.trang_thai === 'cho_xac_nhan' && <><Button size="sm" className="me-1" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: item.id, trang_thai: 'da_xac_nhan' })}>Xác nhận</Button><Button size="sm" variant="outline-danger" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: item.id, trang_thai: 'tu_choi' })}>Từ chối</Button></>}{studio && item.trang_thai === 'da_xac_nhan' && <Button size="sm" onClick={() => navigate(`/staff/orders/new?lich_hen_id=${item.id}`)}>Khách đã đến · tạo đơn</Button>}{!studio && item.trang_thai === 'da_xac_nhan' && <Button size="sm" variant="outline-success" onClick={() => mutation.mutate({ id: item.id, trang_thai: 'da_xong' })}>Đã lấy</Button>}</td></tr>; })}</tbody></Table></div>}</section></div>;
}
