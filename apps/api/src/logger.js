const pino = require('pino');
const pinoHttp = require('pino-http');
const env = require('./config/env');

const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport: env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' }
      }
    : undefined
});

const httpLogger = pinoHttp({ logger });

module.exports = { logger, httpLogger };
