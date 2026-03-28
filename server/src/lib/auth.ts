import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export type AuthUser = {
  id: number;
  email: string;
  role: 'admin' | 'seller';
};

export type AuthRequest = Request & {
  user?: AuthUser;
};

function getJwtSecret() {
  return process.env.JWT_SECRET ?? 'CHANGE_ME_IN_PRODUCTION';
}

export function signAuthToken(user: AuthUser) {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'];
  return jwt.sign(user, getJwtSecret(), {
    expiresIn,
  });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'missing_token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    req.user = decoded;
    next();
  } catch (_error) {
    res.status(401).json({ message: 'invalid_token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'admin_required' });
    return;
  }
  next();
}
