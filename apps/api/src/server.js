const env = require('./config/env');
const { createApp } = require('./app');
const { logger } = require('./logger');
const { closePool } = require('./db/pool');

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API server listening');
});

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
