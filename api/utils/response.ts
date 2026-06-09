import type { Response } from 'express';
import type { ApiResponse } from '../../shared/api-types.js';

export function ok<T>(res: Response, data: T, message = 'OK'): Response<ApiResponse<T>> {
  return res.json({ code: 0, message, data });
}

export function fail(res: Response, message: string, code = 400, statusCode = 400): Response<ApiResponse<null>> {
  return res.status(statusCode).json({ code, message, data: null });
}

export function unauthorized(res: Response, message = '未授权访问，请先登录'): Response {
  return fail(res, message, 401, 401);
}

export function forbidden(res: Response, message = '权限不足'): Response {
  return fail(res, message, 403, 403);
}

export function notFound(res: Response, message = '资源不存在'): Response {
  return fail(res, message, 404, 404);
}

export function serverError(res: Response, message = '服务器内部错误'): Response {
  return fail(res, message, 500, 500);
}
