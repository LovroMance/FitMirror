import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../types/auth';
import { HttpError } from '../utils/http-error';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new HttpError('Unauthorized', 401, 40100);
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = {
      id: Number(payload.sub),
      email: payload.email
    };
    next();
  } catch {
    throw new HttpError('Invalid token', 401, 40101);
  }
};
