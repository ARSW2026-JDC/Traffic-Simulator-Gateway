/**
 * Structured Logging with Pino
 * 
 * Provides JSON structured logging for:
 * - Request/response logging
 * - Error logging
 * - Integration with Loki
 */

import pino from 'pino';
import { config } from '../config/config';

// Create logger instance
export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// REQUEST LOGGING

/**
 * Creates a request logger with context
 */
export function createRequestLogger(req: Request) {
  const startTime = Date.now();

  return {
    info: (message: string, extra = {}) => {
      logger.info({
        msg: message,
        request: {
          method: req.method,
          url: req.url,
          path: req.path,
          headers: {
            host: req.headers.host,
            origin: req.headers.origin,
          },
        },
        ...extra,
      });
    },
    error: (message: string, extra = {}) => {
      logger.error({
        msg: message,
        request: {
          method: req.method,
          url: req.url,
          path: req.path,
        },
        ...extra,
      });
    },
    complete: (statusCode: number) => {
      const duration = Date.now() - startTime;
      logger.info({
        msg: 'Request completed',
        request: {
          method: req.method,
          url: req.url,
          statusCode,
          duration_ms: duration,
        },
      });
    },
  };
}

// Import Request type
import { Request } from 'express';

// PROXY LOGGING

/**
 * Logs proxy events with context
 */
export const proxyLogger = {
  info: (target: string, message: string, extra = {}) => {
    logger.info({
      msg: message,
      proxy: { target },
      ...extra,
    });
  },
  error: (target: string, message: string, error: Error, extra = {}) => {
    logger.error({
      msg: message,
      proxy: { target },
      error: {
        message: error.message,
        code: (error as any).code,
        stack: config.nodeEnv === 'development' ? error.stack : undefined,
      },
      ...extra,
    });
  },
  warn: (target: string, message: string, extra = {}) => {
    logger.warn({
      msg: message,
      proxy: { target },
      ...extra,
    });
  },
};

// WEBSOCKET LOGGING

/**
 * Logs WebSocket events
 */
export const wsLogger = {
  connect: (route: string, clientId: string) => {
    logger.info({
      msg: 'WebSocket connected',
      websocket: { route, clientId },
    });
  },
  disconnect: (route: string, clientId: string, reason: string) => {
    logger.info({
      msg: 'WebSocket disconnected',
      websocket: { route, clientId, reason },
    });
  },
  error: (route: string, clientId: string, error: Error) => {
    logger.error({
      msg: 'WebSocket error',
      websocket: { route, clientId },
      error: { message: error.message },
    });
  },
  message: (route: string, clientId: string, size: number) => {
    logger.debug({
      msg: 'WebSocket message',
      websocket: { route, clientId, size_bytes: size },
    });
  },
};

// AUTH LOGGING

export const authLogger = {
  success: (uid: string, email: string) => {
    logger.info({
      msg: 'Authentication successful',
      auth: { uid, email: email.split('@')[0] + '@***' }, // Mask email
    });
  },
  failure: (reason: string, extra = {}) => {
    logger.warn({
      msg: 'Authentication failed',
      auth: { reason },
      ...extra,
    });
  },
};

// HEALTH LOGGING

export const healthLogger = {
  check: (service: string, status: 'ok' | 'unavailable' | 'error') => {
    if (status !== 'ok') {
      logger.warn({
        msg: 'Health check failed',
        health: { service, status },
      });
    } else {
      logger.debug({
        msg: 'Health check passed',
        health: { service, status },
      });
    }
  },
};