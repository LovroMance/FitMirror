import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import { parseSyncWorkoutRecordsBody } from './workout-records.schema';
import { syncWorkoutRecords } from './workout-records.service';

export const syncWorkoutRecordsController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = parseSyncWorkoutRecordsBody(req.body);
    const userId = req.user?.id;

    if (!userId) {
      throw new HttpError('Unauthorized', 401, 40100);
    }

    const result = await syncWorkoutRecords(userId, input);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
