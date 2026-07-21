const env = require('../config/env');
const notificationRepository = require('../repositories/notification.repository');
const channels = require('./notifications');
const templates = require('./notifications/templates');
const { logger } = require('../logger');
const { parsePagination, buildPagination } = require('../utils/pagination');

function retryDelaySeconds(row) {
  const attempt = Number(row?.so_lan_thu || 0);
  return Math.min(3600, 60 * Math.max(1, attempt + 1));
}

// Records one notification row. Dispatch happens after the caller's transaction
// commits, or from the retry worker.
async function enqueue({ event_type, channel, recipient, subject, body, html, order_id, online_request_id, metadata }, client) {
  if (!recipient) return null;

  return notificationRepository.create({
    channel,
    event_type,
    recipient,
    subject,
    body,
    order_id,
    online_request_id,
    status: 'cho_gui',
    metadata: { ...(metadata || {}), ...(html ? { notification_html: html } : {}) }
  }, client);
}

async function dispatchRow(row) {
  if (!row) return null;
  if (!env.NOTIFICATIONS_ENABLED) {
    return notificationRepository.markStatus(row.id, 'mo_phong', { metadata: { reason: 'notifications_disabled' } });
  }

  try {
    const adapter = channels[row.kenh];
    if (!adapter) throw new Error(`Kênh thông báo không hỗ trợ: ${row.kenh}`);
    const result = await adapter.send({
      to: row.nguoi_nhan,
      subject: row.tieu_de,
      body: row.noi_dung,
      html: row.metadata?.notification_html
    });
    return notificationRepository.markStatus(
      row.id,
      result?.simulated ? 'mo_phong' : 'da_gui',
      { metadata: result?.info || {} }
    );
  } catch (error) {
    logger.error({ err: error, event_type: row.loai_su_kien, channel: row.kenh }, 'Notification dispatch failed');
    return notificationRepository.markStatus(row.id, 'that_bai', {
      error_message: error.message,
      retry_after_seconds: retryDelaySeconds(row)
    });
  }
}

async function dispatchRows(rows = []) {
  const results = [];
  for (const row of rows.filter(Boolean)) {
    try {
      results.push(await dispatchRow(row));
    } catch (error) {
      logger.error({ err: error, notification_id: row.id }, 'Notification outbox dispatch failed');
      results.push(null);
    }
  }
  return results;
}

async function dispatchQueued(limit = 50) {
  const rows = await notificationRepository.dueForDispatch(limit);
  return dispatchRows(rows);
}

// Create all relevant channel rows for an event. Pass the caller's transaction
// client so notification intent is committed atomically with the business change.
// Email goes to payload.email; simulated Zalo goes to payload.phone.
async function enqueueEvent(event_type, payload = {}, client) {
  const template = templates[event_type];
  if (!template) {
    logger.warn({ event_type }, 'Unknown notification event');
    return [];
  }

  const rendered = template(payload);
  const results = [];
  if (payload.email) {
    results.push(await enqueue({
      event_type,
      channel: 'email',
      recipient: payload.email,
      subject: rendered.subject,
      body: rendered.body,
      html: rendered.html,
      order_id: payload.order_id,
      online_request_id: payload.online_request_id,
      metadata: payload.metadata
    }, client));
  }
  if (payload.phone) {
    results.push(await enqueue({
      event_type,
      channel: 'zalo',
      recipient: payload.phone,
      subject: rendered.subject,
      body: rendered.body,
      order_id: payload.order_id,
      online_request_id: payload.online_request_id,
      metadata: payload.metadata
    }, client));
  }
  return results;
}

// Backward-compatible helper for callers that do not already manage a transaction.
async function notifyEvent(event_type, payload = {}) {
  const rows = await enqueueEvent(event_type, payload);
  return dispatchRows(rows);
}

async function listNotifications(query) {
  const pagination = parsePagination(query);
  const result = await notificationRepository.list(query, pagination);
  return {
    data: { notifications: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

module.exports = {
  enqueue,
  enqueueEvent,
  notify: enqueue,
  notifyEvent,
  dispatchRow,
  dispatchRows,
  dispatchQueued,
  listNotifications
};
