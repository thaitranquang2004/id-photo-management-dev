// Kiểm tra chất lượng (QC) ảnh thẻ dùng chung: kết hợp kiểm tra tất định
// (độ phân giải/tỉ lệ từ kích thước ảnh) với phát hiện của AI (Gemini) thành
// danh sách cảnh báo có cấu trúc + điểm chất lượng. Tách riêng để cả pipeline
// xử lý ảnh (photo.service) lẫn endpoint QC công khai (public.service) cùng dùng.

const DEFAULT_DPI = 300;

function mmToPx(mm, dpi = DEFAULT_DPI) {
  return Math.max(1, Math.round((Number(mm) / 25.4) * dpi));
}

function qcIssue(code, severity, message, value = null, threshold = null) {
  return { code, severity, message, value, threshold };
}

function aspectWithinTolerance(a, b, tolerance) {
  if (!a || !b) return true;
  return Math.abs(a - b) / b <= tolerance;
}

// Combine deterministic checks (resolution/aspect from Sharp) with best-effort AI
// findings into structured warnings. QC never blocks on its own in non-strict mode —
// staff always reviews. In strict mode a `fail` rollup rejects the photo.
function computeQc({ sourceWidthPx, sourceHeightPx, cardType, aiFindings }) {
  const issues = [];
  const targetWidth = mmToPx(cardType.rong_mm);
  const targetHeight = mmToPx(cardType.cao_mm);

  if (sourceWidthPx && sourceHeightPx) {
    const minRatio = Math.min(sourceWidthPx / targetWidth, sourceHeightPx / targetHeight);
    if (minRatio < 0.6) {
      issues.push(qcIssue('low_resolution', 'fail',
        `Ảnh gốc ${sourceWidthPx}x${sourceHeightPx}px quá nhỏ so với khổ in ${targetWidth}x${targetHeight}px @${DEFAULT_DPI}dpi`,
        Number(minRatio.toFixed(2)), 0.6));
    } else if (minRatio < 1) {
      issues.push(qcIssue('low_resolution', 'warn',
        'Ảnh gốc nhỏ hơn khổ in mục tiêu, có thể bị mờ khi phóng to',
        Number(minRatio.toFixed(2)), 1));
    }

    const srcAspect = sourceWidthPx / sourceHeightPx;
    const cardAspect = targetWidth / targetHeight;
    if (!aspectWithinTolerance(srcAspect, cardAspect, 0.15)) {
      issues.push(qcIssue('wrong_aspect', 'warn',
        'Tỉ lệ ảnh gốc khác tỉ lệ thẻ; ảnh sẽ có viền nền khi chuẩn hoá (không cắt vào mặt)',
        Number(srcAspect.toFixed(2)), Number(cardAspect.toFixed(2))));
    }
  }

  if (aiFindings) {
    const req = cardType.yeu_cau || {};
    if (aiFindings.face_detected === false || aiFindings.face_count === 0) {
      issues.push(qcIssue('no_face', 'fail', 'Không phát hiện khuôn mặt trong ảnh'));
    }
    if (typeof aiFindings.face_count === 'number' && aiFindings.face_count > 1) {
      issues.push(qcIssue('multiple_faces', 'warn', `Phát hiện ${aiFindings.face_count} khuôn mặt`));
    }
    if (aiFindings.face_centered === false) {
      issues.push(qcIssue('face_not_centered', 'warn', 'Khuôn mặt chưa được căn giữa'));
    }
    if (typeof aiFindings.face_height_ratio === 'number') {
      const minR = Number(req.min_face_ratio) || 0.5;
      const maxR = Number(req.max_face_ratio) || 0.8;
      if (aiFindings.face_height_ratio < minR || aiFindings.face_height_ratio > maxR) {
        issues.push(qcIssue('face_ratio_out_of_range', 'warn',
          `Tỉ lệ khuôn mặt ${(aiFindings.face_height_ratio * 100).toFixed(0)}% ngoài khoảng ${minR}-${maxR}`,
          Number(aiFindings.face_height_ratio.toFixed(2)), `${minR}-${maxR}`));
      }
    }
    if (aiFindings.background_uniform === false) {
      issues.push(qcIssue('background_not_uniform', 'warn', 'Nền chưa đồng nhất'));
    }
    if (aiFindings.background_matches_required_color === false) {
      issues.push(qcIssue('background_wrong_color', 'warn',
        `Nền chưa đúng màu yêu cầu (${cardType.mau_nen || '#FFFFFF'})`));
    }
    if (aiFindings.glare_or_strong_shadow === true) {
      issues.push(qcIssue('glare_or_shadow', 'warn', 'Có loá sáng hoặc bóng đổ mạnh'));
    }
    if (aiFindings.eyes_open === false) {
      issues.push(qcIssue('eyes_closed', 'warn', 'Mắt có thể đang nhắm'));
    }
    if (aiFindings.neutral_expression === false) {
      issues.push(qcIssue('non_neutral_expression', 'warn', 'Biểu cảm chưa trung tính'));
    }
    if (aiFindings.sufficient_sharpness === false) {
      issues.push(qcIssue('low_sharpness', 'warn', 'Ảnh chưa đủ sắc nét'));
    }
  }

  const hasFail = issues.some((item) => item.severity === 'fail');
  const hasWarn = issues.some((item) => item.severity === 'warn');
  const penalty = issues.reduce((sum, item) => sum + (item.severity === 'fail' ? 40 : 10), 0);

  return {
    trang_thai_qc: hasFail ? 'loi' : hasWarn ? 'canh_bao' : 'dat',
    diem_chat_luong: Math.max(0, Math.min(100, 100 - penalty)),
    loi_chat_luong: issues
  };
}

module.exports = { DEFAULT_DPI, mmToPx, computeQc };
