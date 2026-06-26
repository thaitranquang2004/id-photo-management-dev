// Vietnamese notification templates keyed by event_type. Each returns { subject, body }.
const templates = {
  online_request_received: (p) => ({
    subject: 'Đã nhận yêu cầu đặt ảnh thẻ của bạn',
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + `Tiệm hình thẻ đã nhận được yêu cầu của bạn (mã yêu cầu: ${p.online_request_id || '-'}).\n`
      + 'Nhân viên sẽ liên hệ xác nhận và xử lý trong thời gian sớm nhất.\n\n'
      + 'Cảm ơn bạn đã tin tưởng dịch vụ!'
  }),
  online_request_accepted: (p) => ({
    subject: 'Yêu cầu của bạn đã được tiếp nhận',
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + 'Yêu cầu đặt ảnh thẻ online của bạn đã được tiệm tiếp nhận.\n'
      + 'Nhân viên sẽ liên hệ xác nhận lịch hẹn / xử lý ảnh. Cảm ơn bạn!'
  }),
  online_request_rejected: (p) => ({
    subject: 'Yêu cầu đặt ảnh thẻ chưa được tiếp nhận',
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + 'Rất tiếc, yêu cầu của bạn chưa được tiếp nhận.\n'
      + (p.note ? `Lý do: ${p.note}\n` : '')
      + 'Bạn vui lòng liên hệ tiệm để được hỗ trợ thêm. Cảm ơn bạn!'
  }),
  appointment_confirmed: (p) => ({
    subject: 'Lịch hẹn của bạn đã được xác nhận',
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + `Tiệm đã xác nhận lịch hẹn ngày ${p.preferred_date || ''}`
      + (p.time_slot ? ` khung giờ ${p.time_slot}` : '') + '.\n'
      + 'Vui lòng đến đúng giờ. Cảm ơn bạn!'
  }),
  photos_ready: (p) => ({
    subject: `Ảnh thẻ đơn ${p.order_code || ''} đã sẵn sàng`,
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + `Ảnh thẻ của đơn ${p.order_code || ''} đã xử lý xong và sẵn sàng.\n`
      + (p.lookup_url
        ? `Xem và tải ảnh tại: ${p.lookup_url}\n`
        : `Vui lòng tra cứu bằng số điện thoại và mã đơn ${p.order_code || ''} tại trang tra cứu.\n`)
      + (p.pickup_date ? `Hẹn lấy: ${p.pickup_date}\n` : '')
      + '\nCảm ơn bạn!'
  }),
  order_delivered: (p) => ({
    subject: `Đơn ${p.order_code || ''} đã hoàn tất`,
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + `Đơn ${p.order_code || ''} đã được giao/hoàn tất.\n`
      + 'Cảm ơn bạn đã sử dụng dịch vụ của Tiệm hình thẻ!'
  }),
  order_cancelled: (p) => ({
    subject: `Đơn ${p.order_code || ''} đã bị huỷ`,
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + `Đơn ${p.order_code || ''} đã được huỷ.\n`
      + (p.reason ? `Lý do: ${p.reason}\n` : '')
      + 'Nếu có thắc mắc hoặc cần hoàn tiền, vui lòng liên hệ tiệm. Cảm ơn bạn!'
  }),
  reprint_approved: (p) => ({
    subject: `Yêu cầu in lại đã được tiếp nhận (đơn ${p.order_code || ''})`,
    body: `Chào ${p.customer_name || 'bạn'},\n\n`
      + `Yêu cầu in lại của bạn đã được duyệt và tạo đơn ${p.order_code || ''}`
      + (p.quantity ? ` (số lượng: ${p.quantity})` : '') + '.\n'
      + 'Nhân viên sẽ chuẩn bị và thông báo khi sẵn sàng. Cảm ơn bạn!'
  })
};

module.exports = templates;
