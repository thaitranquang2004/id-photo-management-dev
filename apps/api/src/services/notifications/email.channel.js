const env = require('../../config/env');
const { logger } = require('../../logger');

let transport = null;

function getTransport() {
  if (!env.SMTP_HOST) return null;
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
  }
  return transport;
}

// Sends a real email when SMTP is configured; otherwise degrades to a simulated
// (log-only) success so the flow never breaks without SMTP credentials.
async function send({ to, subject, body }) {
  const mailer = getTransport();
  if (!mailer) {
    logger.info({ to, subject }, 'Email channel: SMTP not configured, simulated');
    return { simulated: true, info: { reason: 'smtp_not_configured' } };
  }

  const info = await mailer.sendMail({ from: env.MAIL_FROM, to, subject, text: body });
  return { simulated: false, info: { message_id: info.messageId } };
}

module.exports = { send };
