import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Modal cắt ảnh thủ công, khóa theo tỷ lệ loại thẻ của đơn (aspect = rộng/cao).
// Trả về một File mới (JPEG) đã cắt qua onConfirm; giữ nguyên tên file gốc.
export default function PhotoCropModal({ file, aspect, ratioLabel, onConfirm, onClose }) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [busy, setBusy] = useState(false);

  // Tạo object URL cho ảnh đang cắt, thu hồi khi đóng/đổi file.
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop(undefined);
    setCompletedCrop(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onImageLoad(event) {
    const { width, height } = event.currentTarget;
    const percentCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect || width / height, width, height),
      width,
      height
    );
    setCrop(percentCrop);
    // Khởi tạo vùng cắt theo pixel hiển thị để nút "Cắt" dùng được ngay cả khi user không kéo.
    setCompletedCrop({
      unit: 'px',
      x: (percentCrop.x / 100) * width,
      y: (percentCrop.y / 100) * height,
      width: (percentCrop.width / 100) * width,
      height: (percentCrop.height / 100) * height
    });
  }

  async function handleConfirm() {
    const image = imgRef.current;
    if (!image || !completedCrop?.width || !completedCrop?.height) return;
    setBusy(true);
    try {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(completedCrop.width * scaleX);
      canvas.height = Math.round(completedCrop.height * scaleY);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) return;
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const cropped = new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={Boolean(file)} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Cắt ảnh{ratioLabel ? ` · khổ ${ratioLabel}` : ''}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        <p className="text-muted small">
          Kéo để chọn vùng cắt. Khung được khóa đúng khổ ảnh thẻ của đơn{ratioLabel ? ` (${ratioLabel})` : ''}.
        </p>
        {src ? (
          <ReactCrop
            crop={crop}
            onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
            onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
            aspect={aspect || undefined}
            keepSelection
          >
            <img ref={imgRef} src={src} alt="Ảnh cần cắt" onLoad={onImageLoad} style={{ maxHeight: '60vh' }} />
          </ReactCrop>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={busy}>Hủy</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy || !completedCrop?.width}>
          {busy ? <Spinner size="sm" animation="border" /> : 'Cắt & upload'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
