const { build } = require('./email-render');

// Templates thông báo tiếng Việt theo event_type. Mỗi hàm trả về { subject, body, html }.
// - body: text thuần (lưu DB, dùng cho Zalo / fallback).
// - html: email có thương hiệu (dựng bởi email-render).
const templates = {
  dat_lich_chup_da_nhan: (p) => build({ subject: 'Đã nhận yêu cầu đặt lịch chụp', title: 'Đã nhận lịch chụp', greeting: `Chào ${p.customer_name || 'bạn'},`, intro: ['Tiệm đã nhận yêu cầu đặt lịch chụp của bạn và sẽ phản hồi qua email này.'], meta: [{ label: 'Ngày hẹn', value: p.preferred_date }, { label: 'Khung giờ', value: p.time_slot }], outro: 'Cảm ơn bạn!' }),
  dat_lich_chup_da_xac_nhan: (p) => build({ subject: 'Lịch chụp đã được xác nhận', title: 'Lịch chụp đã được xác nhận', greeting: `Chào ${p.customer_name || 'bạn'},`, intro: ['Tiệm xác nhận lịch chụp của bạn.'], meta: [{ label: 'Ngày hẹn', value: p.preferred_date }, { label: 'Khung giờ', value: p.time_slot }], outro: 'Vui lòng đến đúng giờ. Cảm ơn bạn!' }),
  dat_lich_chup_tu_choi: (p) => build({ subject: 'Lịch chụp chưa thể xác nhận', title: 'Lịch chụp chưa thể xác nhận', greeting: `Chào ${p.customer_name || 'bạn'},`, intro: ['Rất tiếc, tiệm chưa thể xác nhận lịch chụp này.'], note: p.note, outro: 'Bạn vui lòng chọn thời gian khác hoặc liên hệ tiệm.' }),
  don_gui_anh_da_nhan: (p) => build({ subject: `Đã nhận đơn gửi ảnh ${p.order_code || ''}`, title: 'Đã nhận đơn gửi ảnh', greeting: `Chào ${p.customer_name || 'bạn'},`, intro: [`Tiệm đã nhận đơn **${p.order_code || ''}** và ảnh của bạn. Nhân viên sẽ xử lý trong thời gian sớm nhất.`], outro: 'Cảm ơn bạn!' }),
  nhac_hen_lay_hinh: (p) => build({ subject: 'Nhắc lịch lấy hình vào ngày mai', title: 'Nhắc lịch lấy hình', greeting: `Chào ${p.customer_name || 'bạn'},`, intro: ['Tiệm xin nhắc lịch lấy hình của bạn vào ngày mai.'], meta: [{ label: 'Ngày lấy', value: p.preferred_date }, { label: 'Khung giờ', value: p.time_slot }], outro: 'Cảm ơn bạn!' }),
  online_request_received: (p) =>
    build({
      subject: 'Đã nhận yêu cầu đặt ảnh thẻ của bạn',
      title: 'Đã nhận yêu cầu của bạn',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: [
        `Tiệm hình thẻ đã nhận được yêu cầu của bạn${p.online_request_id ? ` (mã yêu cầu: **${p.online_request_id}**)` : ''}.`,
        'Nhân viên sẽ liên hệ xác nhận và xử lý trong thời gian sớm nhất.'
      ],
      outro: 'Cảm ơn bạn đã tin tưởng dịch vụ!'
    }),

  online_request_accepted: (p) =>
    build({
      subject: 'Yêu cầu của bạn đã được tiếp nhận',
      title: 'Yêu cầu đã được tiếp nhận',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: [
        'Yêu cầu đặt ảnh thẻ online của bạn đã được tiệm tiếp nhận.',
        'Nhân viên sẽ liên hệ xác nhận lịch hẹn / xử lý ảnh.'
      ],
      outro: 'Cảm ơn bạn!'
    }),

  online_request_rejected: (p) =>
    build({
      subject: 'Yêu cầu đặt ảnh thẻ chưa được tiếp nhận',
      title: 'Yêu cầu chưa được tiếp nhận',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: ['Rất tiếc, yêu cầu của bạn chưa được tiếp nhận.'],
      note: p.note ? `Lý do: ${p.note}` : '',
      outro: 'Bạn vui lòng liên hệ tiệm để được hỗ trợ thêm. Cảm ơn bạn!'
    }),

  photos_ready: (p) =>
    build({
      subject: `Ảnh thẻ đơn ${p.order_code || ''} đã sẵn sàng`,
      title: 'Ảnh thẻ đã sẵn sàng',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: [
        `Ảnh thẻ của đơn **${p.order_code || ''}** đã xử lý xong và sẵn sàng để bạn xem và tải về.`,
        ...(p.lookup_url
          ? []
          : [`Vui lòng tra cứu bằng số điện thoại và mã đơn **${p.order_code || ''}** tại trang tra cứu.`])
      ],
      button: p.lookup_url ? { label: 'Xem & tải ảnh', url: p.lookup_url } : null,
      meta: p.pickup_date ? [{ label: 'Hẹn lấy', value: p.pickup_date }] : [],
      outro: 'Cảm ơn bạn!'
    }),

  order_delivered: (p) =>
    build({
      subject: `Đơn ${p.order_code || ''} đã hoàn tất`,
      title: 'Đơn hàng đã hoàn tất',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: [`Đơn **${p.order_code || ''}** đã được giao / hoàn tất.`],
      outro: 'Cảm ơn bạn đã sử dụng dịch vụ của Tiệm hình thẻ!'
    }),

  order_cancelled: (p) =>
    build({
      subject: `Đơn ${p.order_code || ''} đã bị huỷ`,
      title: 'Đơn hàng đã bị huỷ',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: [`Đơn **${p.order_code || ''}** đã được huỷ.`],
      note: p.reason ? `Lý do: ${p.reason}` : '',
      outro: 'Nếu có thắc mắc hoặc cần hoàn tiền, vui lòng liên hệ tiệm. Cảm ơn bạn!'
    }),

  reprint_approved: (p) =>
    build({
      subject: `Yêu cầu in lại đã được tiếp nhận (đơn ${p.order_code || ''})`,
      title: 'Yêu cầu in lại đã được duyệt',
      greeting: `Chào ${p.customer_name || 'bạn'},`,
      intro: [`Yêu cầu in lại của bạn đã được duyệt và tạo đơn **${p.order_code || ''}**.`],
      meta: p.quantity ? [{ label: 'Số lượng', value: String(p.quantity) }] : [],
      outro: 'Nhân viên sẽ chuẩn bị và thông báo khi sẵn sàng. Cảm ơn bạn!'
    })
};

module.exports = templates;
