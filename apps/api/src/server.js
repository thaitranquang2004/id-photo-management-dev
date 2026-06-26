const cron = require('node-cron');
const env = require('./config/env');
const { createApp } = require('./app');
const { logger } = require('./logger');
const { closePool } = require('./db/pool');
const { purgeOldOrders } = require('./services/cleanup.service');

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API server listening');
});

// Tự động dọn ảnh Cloudinary của đơn cũ hơn 6 tháng (hằng ngày lúc 03:00).
if (env.ASSET_PURGE_ENABLED) {
  cron.schedule('0 3 * * *', () => {
    purgeOldOrders().catch((err) => logger.error({ err }, 'Asset purge cron failed'));
  });
  logger.info('Asset purge cron scheduled (daily 03:00)');
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down API server');
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server };
