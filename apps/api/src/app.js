const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const apiRouter = require('./routes');
const { httpLogger } = require('./logger');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

function createApp() {
  const app = express();

  const corsOrigin = env.CORS_ORIGIN === '*'
    ? true
    : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.disable('x-powered-by');
  // This API only serves JSON to the SPA (no server-rendered HTML), so the default
  // restrictive CSP from helmet is unnecessary; the other headers (HSTS, frameguard,
  // noSniff, etc.) are what protect the API surface.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(httpLogger);

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
