import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../middlewares/auth';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import { getCurrentUser, loginUser, registerUser } from './auth.service';

const authRouter = Router();

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!email || !username || !password) {
      throw new HttpError('Missing required fields', 400, 40001);
    }

    if (!isValidEmail(email)) {
      throw new HttpError('Invalid email format', 400, 40002);
    }

    if (username.length < 2 || username.length > 20) {
      throw new HttpError('Username length must be between 2 and 20', 400, 40003);
    }

    if (password.length < 8) {
      throw new HttpError('Password must be at least 8 characters', 400, 40004);
    }

    const result = await registerUser({ email, username, password });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = String(req.body.account ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!account || !password) {
      throw new HttpError('Missing required fields', 400, 40001);
    }

    const result = await loginUser({ account, password });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new HttpError('Unauthorized', 401, 40100);
    }

    const user = await getCurrentUser(req.user.id);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

export { authRouter };
