import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Table } from 'react-bootstrap';
import { listKhungGioChupAdmin, updateKhungGioChup } from '../../api/admin.js';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';

export default function StudioSlotsPage() {
  const client = useQueryClient(); const query = useQuery({ queryKey: ['khung-gio-chup-admin'], queryFn: listKhungGioChupAdmin });
  const mutation = useMutation({ mutationFn: ({ id, payload }) => updateKhungGioChup(id, payload), onSuccess: () => client.invalidateQueries({ queryKey: ['khung-gio-chup-admin'] }) });
  if (query.isLoading) return <LoadingState/>; if (query.error) return <ErrorState error={query.error}/>;
  return <div className="page-stack"><div className="page-header"><div><h1>Khung giờ chụp</h1><p>Sức chứa chỉ áp dụng cho lịch đặt chụp, không áp dụng lịch hẹn lấy hình.</p></div></div><section className="app-panel"><Table className="align-middle"><thead><tr><th>Khung giờ</th><th>Sức chứa tối đa</th><th>Hoạt động</th><th /></tr></thead><tbody>{(query.data?.khung_gio || []).map((slot) => <SlotRow slot={slot} key={slot.id} saving={mutation.isPending} save={(payload) => mutation.mutate({ id: slot.id, payload })}/>)}</tbody></Table></section></div>;
}
function SlotRow({ slot, save, saving }) { const formId = `slot-${slot.id}`; return <tr><td>{slot.khung_gio}</td><td><Form.Control form={formId} name="suc_chua_toi_da" type="number" min="1" defaultValue={slot.suc_chua_toi_da}/></td><td><Form.Check form={formId} name="dang_hoat_dong" defaultChecked={slot.dang_hoat_dong}/></td><td><form id={formId} onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); save({ suc_chua_toi_da: Number(d.get('suc_chua_toi_da')), dang_hoat_dong: d.get('dang_hoat_dong') === 'on' }); }}><Button size="sm" type="submit" disabled={saving}>Lưu</Button></form></td></tr>; }
