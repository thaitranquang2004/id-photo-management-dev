const notificationService = require('../services/notification.service');
const { sendSuccess } = require('../utils/responses');

async function list(req, res) {
  const result = await notificationService.listNotifications(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

module.exports = { list };
