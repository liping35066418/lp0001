import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { serverError, fail } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('[Unhandled Error]', err.message, err.stack);
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return fail(res, `参数错误: ${messages}`, 422, 422);
  }
  if (res.headersSent) return;
  return serverError(res);
};

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
}
