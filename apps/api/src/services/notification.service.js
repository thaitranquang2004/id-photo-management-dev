const env = require('../config/env');
const notificationRepository = require('../repositories/notification.repository');
const channels = require('./notifications');
const templates = require('./notifications/templates');
const { logger } = require('../logger');
const { parsePagination, buildPagination } = require('../utils/pagination');

// Records one notification row and dispatches it through the channel adapter.
// Channel errors are swallowed (row marked failed) so a mail outage never breaks
// the calling flow.
async function notify({ event_type, channel, recipient, subject, body, html, order_id, online_request_id, metadata }, client) {
  if (!recipient) return null;

  const row = await notificationRepository.create({
    channel,
    event_type,
    recipient,
    subject,
    body,
    order_id,
    online_request_id,
    status: 'pending',
    metadata: metadata || {}
  }, client);

  if (!env.NOTIFICATIONS_ENABLED) {
    return notificationRepository.markStatus(row.id, 'simulated', { metadata: { reason: 'notifications_disabled' } }, client);
  }

  try {
    const adapter = channels[channel];
    if (!adapter) throw new Error(`Kênh thông báo không hỗ trợ: ${channel}`);
    const result = await adapter.send({ to: recipient, subject, body, html });
    return notificationRepository.markStatus(
      row.id,
      result?.simulated ? 'simulated' : 'sent',
      { metadata: result?.info || {} },
      client
    );
  } catch (error) {
    logger.error({ err: error, event_type, channel }, 'Notification dispatch failed');
    return notificationRepository.markStatus(row.id, 'failed', { error_message: error.message }, client);
  }
}

// Fire all relevant channels for an event. NEVER throws — notification problems must
// not break the business flow. Call AFTER the triggering transaction commits.
// Email goes to payload.email; simulated Zalo goes to payload.phone.
async function notifyEvent(event_type, payload = {}) {
  const template = templates[event_type];
  if (!template) {
    logger.warn({ event_type }, 'Unknown notification event');
    return [];
  }

  const rendered = template(payload);
  const results = [];
  try {
    if (payload.email) {
      results.push(await notify({
        event_type,
        channel: 'email',
        recipient: payload.email,
        subject: rendered.subject,
        body: rendered.body,
        html: rendered.html,
        order_id: payload.order_id,
        online_request_id: payload.online_request_id,
        metadata: payload.metadata
      }));
    }
    if (payload.phone) {
      results.push(await notify({
        event_type,
        channel: 'zalo',
        recipient: payload.phone,
        subject: rendered.subject,
        body: rendered.body,
        order_id: payload.order_id,
        online_request_id: payload.online_request_id,
        metadata: payload.metadata
      }));
    }
  } catch (error) {
    logger.error({ err: error, event_type }, 'notifyEvent failed');
  }
  return results;
}

async function listNotifications(query) {
  const pagination = parsePagination(query);
  const result = await notificationRepository.list(query, pagination);
  return {
    data: { notifications: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

module.exports = { notify, notifyEvent, listNotifications };
