import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Chưa có dữ liệu', description = 'Dữ liệu sẽ hiển thị tại đây khi backend trả về kết quả.' }) {
  return (
    <div className="empty-state">
      <Inbox size={28} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
