import { Pagination } from 'react-bootstrap';

// Compact pager driven by 1-based page + total page count.
// Renders nothing when there is a single page (or none).
export default function PaginationBar({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const go = (target) => {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next !== page) onChange(next);
  };

  // Window of at most 5 page numbers centred on the current page.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const items = [];
  for (let p = start; p <= end; p += 1) items.push(p);

  return (
    <Pagination className="justify-content-end mb-0 mt-3">
      <Pagination.First disabled={page <= 1} onClick={() => go(1)} />
      <Pagination.Prev disabled={page <= 1} onClick={() => go(page - 1)} />
      {start > 1 ? <Pagination.Ellipsis disabled /> : null}
      {items.map((p) => (
        <Pagination.Item key={p} active={p === page} onClick={() => go(p)}>{p}</Pagination.Item>
      ))}
      {end < totalPages ? <Pagination.Ellipsis disabled /> : null}
      <Pagination.Next disabled={page >= totalPages} onClick={() => go(page + 1)} />
      <Pagination.Last disabled={page >= totalPages} onClick={() => go(totalPages)} />
    </Pagination>
  );
}
