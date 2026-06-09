import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { unauthorized, forbidden } from '../utils/response.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        realName: string;
        role: 'admin' | 'operator';
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'boardgame-station-secret';

export function signToken(user: { id: number; username: string; realName: string; role: string }): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN as unknown as jwt.SignOptions['expiresIn']) || '24h';
  return jwt.sign(
    { id: user.id, username: user.username, realName: user.realName, role: user.role },
    JWT_SECRET as jwt.Secret,
    { expiresIn }
  );
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || req.headers['Authorization'] as string | undefined;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) { unauthorized(res); return; }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Request['user'];
    req.user = decoded;
    next();
  } catch {
    unauthorized(res, '登录已过期，请重新登录');
  }
}

export function adminRequired(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { unauthorized(res); return; }
  if (req.user.role !== 'admin') { forbidden(res); return; }
  next();
}
