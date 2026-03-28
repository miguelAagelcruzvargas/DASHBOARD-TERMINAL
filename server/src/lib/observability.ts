import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

type StatusBucket = {
  total: number;
  byCode: Record<string, number>;
  errors4xx: number;
  errors5xx: number;
  totalDurationMs: number;
};

const state: StatusBucket = {
  total: 0,
  byCode: {},
  errors4xx: 0,
  errors5xx: 0,
  totalDurationMs: 0,
};

function getCorrelationId(request: Request): string {
  const incoming = request.headers['x-correlation-id'];
  if (typeof incoming === 'string' && incoming.trim().length > 0) return incoming.trim();
  return crypto.randomUUID();
}

export function observabilityMiddleware(request: Request, response: Response, next: NextFunction) {
  const startedAt = Date.now();
  const correlationId = getCorrelationId(request);

  response.setHeader('x-correlation-id', correlationId);

  response.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const statusCode = response.statusCode;
    const statusKey = statusCode.toString();

    state.total += 1;
    state.byCode[statusKey] = (state.byCode[statusKey] ?? 0) + 1;
    state.totalDurationMs += durationMs;

    if (statusCode >= 400 && statusCode < 500) state.errors4xx += 1;
    if (statusCode >= 500) state.errors5xx += 1;

    const logPayload = {
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      type: 'http_request',
      correlationId,
      method: request.method,
      path: request.path,
      statusCode,
      durationMs,
      userAgent: request.headers['user-agent'] ?? '',
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logPayload));
  });

  next();
}

export function getObservabilitySnapshot() {
  const avgLatencyMs = state.total > 0 ? state.totalDurationMs / state.total : 0;
  return {
    requests: {
      total: state.total,
      byCode: state.byCode,
      errors4xx: state.errors4xx,
      errors5xx: state.errors5xx,
      avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
