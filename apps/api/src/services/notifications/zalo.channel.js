const { logger } = require('../../logger');

// Simulated Zalo channel: demonstrates the Vietnamese notification flow without a
// real Zalo OA account. Records the message in the log and never calls the network.
async function send({ to, subject, body }) {
  logger.info({ to, subject, body }, '[ZALO SIMULATED] notification');
  return { simulated: true, info: { provider: 'zalo_simulated' } };
}

module.exports = { send };
