// Dựng email HTML có thương hiệu (an toàn với các trình đọc mail: dùng bảng + style inline)
// và bản text thuần tương ứng để gửi kèm/để Zalo dùng lại.

const BRAND = 'Tiệm hình thẻ';
const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4f46e5',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  soft: '#f1f5f9',
  card: '#ffffff'
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Cho phép in đậm giá trị bằng cú pháp **...** trong nội dung đã escape.
function applyEmphasis(escaped) {
  return escaped.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${COLORS.text}">$1</strong>`);
}

function stripEmphasis(raw) {
  return String(raw == null ? '' : raw).replace(/\*\*(.+?)\*\*/g, '$1');
}

/**
 * content = {
 *   subject, title, greeting,
 *   intro: string[],          // đoạn văn (hỗ trợ **đậm**)
 *   meta:  [{ label, value }] // bảng thông tin tuỳ chọn
 *   button: { label, url },   // nút CTA tuỳ chọn
 *   note,                     // ghi chú nhỏ tuỳ chọn (vd lý do/hẹn lấy)
 *   outro                     // câu kết
 * }
 */
function renderHtml(content) {
  const {
    title = '',
    greeting = '',
    intro = [],
    meta = [],
    button = null,
    note = '',
    outro = ''
  } = content;

  const introHtml = intro
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${COLORS.muted}">${applyEmphasis(escapeHtml(line))}</p>`
    )
    .join('');

  const metaHtml = meta.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border-collapse:separate;border-spacing:0;background:${COLORS.soft};border:1px solid ${COLORS.border};border-radius:10px;overflow:hidden">`
      + meta
        .map(
          (row, idx) =>
            `<tr>`
            + `<td style="padding:11px 16px;font-size:13px;color:${COLORS.muted};${idx ? `border-top:1px solid ${COLORS.border};` : ''}white-space:nowrap">${escapeHtml(row.label)}</td>`
            + `<td style="padding:11px 16px;font-size:14px;font-weight:600;color:${COLORS.text};text-align:right;${idx ? `border-top:1px solid ${COLORS.border};` : ''}">${escapeHtml(row.value)}</td>`
            + `</tr>`
        )
        .join('')
      + `</table>`
    : '';

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td style="border-radius:10px;background:${COLORS.primary}">`
      + `<a href="${escapeHtml(button.url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(button.label)}</a>`
      + `</td></tr></table>`
      + `<p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:${COLORS.muted};word-break:break-all">Hoặc mở liên kết: <a href="${escapeHtml(button.url)}" target="_blank" style="color:${COLORS.primary}">${escapeHtml(button.url)}</a></p>`
    : '';

  const noteHtml = note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="padding:12px 16px;background:#eef2ff;border:1px solid rgba(99,102,241,0.18);border-radius:10px;font-size:13px;line-height:1.6;color:#4338ca">${applyEmphasis(escapeHtml(note))}</td></tr></table>`
    : '';

  const outroHtml = outro
    ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:${COLORS.muted}">${applyEmphasis(escapeHtml(outro))}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject || BRAND)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.soft};-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.soft};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06)">
        <tr><td style="height:5px;background:${COLORS.primary};line-height:5px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:26px 32px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;vertical-align:middle"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${COLORS.primary}"></span></td>
            <td style="vertical-align:middle;font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${COLORS.text}">${escapeHtml(BRAND)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 32px 4px">
          <h1 style="margin:0 0 4px;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.02em;color:${COLORS.text}">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:12px 32px 28px">
          ${greeting ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COLORS.text};font-weight:600">${escapeHtml(greeting)}</p>` : ''}
          ${introHtml}
          ${metaHtml}
          ${buttonHtml}
          ${noteHtml}
          ${outroHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;background:${COLORS.soft};border-top:1px solid ${COLORS.border}">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${COLORS.text}">${escapeHtml(BRAND)}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:${COLORS.muted}">Chuyên chụp &amp; in ảnh thẻ, ảnh hồ sơ lấy ngay.<br>Email tự động, vui lòng không trả lời email này.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8">© ${new Date().getFullYear()} ${escapeHtml(BRAND)}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderText(content) {
  const { greeting = '', intro = [], meta = [], button = null, note = '', outro = '' } = content;
  const parts = [];
  if (greeting) parts.push(greeting);
  const bodyLines = intro.map(stripEmphasis);
  meta.forEach((row) => bodyLines.push(`${row.label}: ${row.value}`));
  if (button) bodyLines.push(`${button.label}: ${button.url}`);
  if (note) bodyLines.push(stripEmphasis(note));
  if (bodyLines.length) parts.push(bodyLines.join('\n'));
  if (outro) parts.push(stripEmphasis(outro));
  return parts.join('\n\n');
}

// Nhận content có cấu trúc -> trả về { subject, body (text), html }.
function build(content) {
  return {
    subject: content.subject,
    body: renderText(content),
    html: renderHtml(content)
  };
}

module.exports = { build };
