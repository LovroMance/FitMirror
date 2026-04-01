import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import { parseSyncPlansBody } from './plans-sync.schema';
import { syncPlans } from './plans-sync.service';

export const syncPlansController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = parseSyncPlansBody(req.body);
    const userId = req.user?.id;

    if (!userId) {
      throw new HttpError('Unauthorized', 401, 40100);
    }

    const result = await syncPlans(userId, input);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
