import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import { getCurrentUser, loginUser, registerUser } from './auth.service';
import { parseLoginInput, parseRegisterInput } from './auth.schema';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = parseRegisterInput(req.body);
    const result = await registerUser(input);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = parseLoginInput(req.body);
    const result = await loginUser(input);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new HttpError('Unauthorized', 401, 40100);
    }

    const user = await getCurrentUser(req.user.id);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};
