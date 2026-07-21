import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Col, Form, Row } from 'react-bootstrap';
import { Download, Printer, Plus, X } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const A4_W_MM = 210;
const A4_H_MM = 297;

let tileSeq = 0;
function makeTile(photo) {
  tileSeq += 1;
  return { key: `tile-${tileSeq}`, url: photo.url, photoId: photo.id };
}

function SortableTile({ id, url, widthMm, heightMm, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${widthMm}mm`,
    height: `${heightMm}mm`,
    opacity: isDragging ? 0.5 : 1
  };
  return (
    <div ref={setNodeRef} className="a4-tile" style={style} {...attributes} {...listeners}>
      {url ? <img src={url} alt="" /> : <span className="a4-tile-empty">—</span>}
      <button
        type="button"
        className="a4-tile-remove no-print"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(id)}
        aria-label="Bỏ ảnh khỏi tờ in"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

// Xếp linh hoạt ảnh đã duyệt lên khung A4 đúng tỉ lệ: chọn từng ảnh từ palette, thêm/bớt/kéo, rồi in/tải.
export default function LayoutComposer({ photos, widthMm, heightMm }) {
  const w = Number(widthMm) || 30;
  const h = Number(heightMm) || 40;
  const [copies, setCopies] = useState(4);
  const [marginMm, setMarginMm] = useState(3);
  const [gapMm, setGapMm] = useState(0);
  const [tiles, setTiles] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const inited = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const usablePhotos = useMemo(() => photos.filter((p) => p.url), [photos]);

  // Xếp tự động: `copies` bản mỗi ảnh, xen kẽ để các ảnh phân bố đều trên tờ.
  function autoFill() {
    const next = [];
    for (let i = 0; i < copies; i += 1) {
      usablePhotos.forEach((p) => next.push(makeTile(p)));
    }
    setTiles(next);
  }

  function addOne(photo) {
    setTiles((prev) => [...prev, makeTile(photo)]);
  }

  function removeTile(key) {
    setTiles((prev) => prev.filter((t) => t.key !== key));
  }

  // Lần đầu có ảnh thì xếp tự động một lần; sau đó người dùng tự chủ động thêm/bớt.
  useEffect(() => {
    if (!inited.current && usablePhotos.length > 0) {
      inited.current = true;
      const next = [];
      for (let i = 0; i < copies; i += 1) usablePhotos.forEach((p) => next.push(makeTile(p)));
      setTiles(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usablePhotos.length]);

  const capacity = useMemo(() => {
    const cols = Math.max(1, Math.floor((A4_W_MM - marginMm * 2 + gapMm) / (w + gapMm)));
    const rows = Math.max(1, Math.floor((A4_H_MM - marginMm * 2 + gapMm) / (h + gapMm)));
    return cols * rows;
  }, [w, h, marginMm, gapMm]);

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // Vẽ các ô đang xếp ra canvas A4 đúng kích thước (300 DPI) rồi tải PNG; tách trang nếu vượt 1 tờ.
  async function downloadA4() {
    if (tiles.length === 0) return;
    setDownloading(true);
    try {
      const pxPerMm = 300 / 25.4;
      const pageW = Math.round(A4_W_MM * pxPerMm);
      const pageH = Math.round(A4_H_MM * pxPerMm);
      const cols = Math.max(1, Math.floor((A4_W_MM - marginMm * 2 + gapMm) / (w + gapMm)));
      const rows = Math.max(1, Math.floor((A4_H_MM - marginMm * 2 + gapMm) / (h + gapMm)));
      const perPage = cols * rows;
      const images = await Promise.all(tiles.map((t) => loadImage(t.url)));
      const pages = Math.max(1, Math.ceil(images.length / perPage));
      for (let p = 0; p < pages; p += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, pageW, pageH);
        for (let i = 0; i < perPage; i += 1) {
          const idx = p * perPage + i;
          if (idx >= images.length) break;
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = (marginMm + col * (w + gapMm)) * pxPerMm;
          const y = (marginMm + row * (h + gapMm)) * pxPerMm;
          ctx.drawImage(images[idx], x, y, w * pxPerMm, h * pxPerMm);
        }
        // eslint-disable-next-line no-await-in-loop
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = pages > 1 ? `layout-a4-trang-${p + 1}.png` : 'layout-a4.png';
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert('Không tải được layout. Thử lại sau.');
    } finally {
      setDownloading(false);
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTiles((items) => {
      const oldIndex = items.findIndex((t) => t.key === active.id);
      const newIndex = items.findIndex((t) => t.key === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  if (usablePhotos.length === 0) {
    return <p className="text-muted mb-0">Chưa có ảnh đã duyệt để dàn layout. Duyệt ảnh ở tab “Ảnh &amp; AI” trước.</p>;
  }

  return (
    <div className="layout-composer">
      <div className="layout-palette no-print">
        <span className="layout-palette-label">Ảnh đã duyệt ({usablePhotos.length}) — bấm để thêm vào tờ in:</span>
        <div className="layout-palette-items">
          {usablePhotos.map((p) => {
            const count = tiles.filter((t) => t.photoId === p.id).length;
            return (
              <button type="button" key={p.id} className="layout-palette-item" onClick={() => addOne(p)} title="Thêm 1 ô ảnh này">
                <img src={p.url} alt="" />
                {count > 0 ? <span className="layout-palette-count">{count}</span> : null}
                <span className="layout-palette-add"><Plus size={14} aria-hidden="true" /></span>
              </button>
            );
          })}
        </div>
      </div>

      <Row className="g-3 align-items-end no-print">
        <Col xs={6} md={3}>
          <Form.Group>
            <Form.Label>Số bản mỗi ảnh</Form.Label>
            <Form.Control type="number" min="1" value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} />
          </Form.Group>
        </Col>
        <Col xs={6} md={3}>
          <Form.Group>
            <Form.Label>Lề (mm)</Form.Label>
            <Form.Control type="number" min="0" value={marginMm} onChange={(e) => setMarginMm(Math.max(0, Number(e.target.value) || 0))} />
          </Form.Group>
        </Col>
        <Col xs={6} md={3}>
          <Form.Group>
            <Form.Label>Khoảng cách (mm)</Form.Label>
            <Form.Control type="number" min="0" value={gapMm} onChange={(e) => setGapMm(Math.max(0, Number(e.target.value) || 0))} />
          </Form.Group>
        </Col>
        <Col xs={12} md={3} className="d-flex gap-2 flex-wrap">
          <Button variant="outline-secondary" onClick={autoFill}>Xếp tự động</Button>
          <Button variant="outline-danger" onClick={() => setTiles([])} disabled={tiles.length === 0}>Xóa hết</Button>
        </Col>
      </Row>

      <div className="d-flex gap-2 flex-wrap no-print mt-2">
        <Button onClick={() => window.print()} disabled={tiles.length === 0}>
          <Printer size={16} aria-hidden="true" /> In A4
        </Button>
        <Button variant="outline-primary" onClick={downloadA4} disabled={downloading || tiles.length === 0}>
          <Download size={16} aria-hidden="true" /> {downloading ? 'Đang tải...' : 'Tải PNG'}
        </Button>
      </div>

      <p className="text-muted small no-print mt-2">
        Ảnh {w}×{h}mm · ~{capacity} ô/trang · {tiles.length} ô đang xếp. Kéo để sắp xếp lại, bấm{' '}
        <strong>×</strong> trên ô để bỏ, hoặc bấm ảnh ở palette để thêm. Khi in chọn khổ <strong>A4</strong>, lề{' '}
        <strong>None/Không</strong> để đúng kích thước.
      </p>

      <div className="a4-print-wrap">
        <div className="a4-print-area" style={{ padding: `${marginMm}mm`, gap: `${gapMm}mm` }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tiles.map((t) => t.key)} strategy={rectSortingStrategy}>
              {tiles.map((t) => (
                <SortableTile key={t.key} id={t.key} url={t.url} widthMm={w} heightMm={h} onRemove={removeTile} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
