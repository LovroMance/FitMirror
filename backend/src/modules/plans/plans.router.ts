import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import { generatePlanFromGoal } from './plans.service';

const plansRouter = Router();

plansRouter.post('/generate', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalText = String(req.body.goalText ?? '').trim();

    if (!goalText) {
      throw new HttpError('goalText is required', 400, 40001);
    }

    if (goalText.length > 500) {
      throw new HttpError('goalText is too long', 400, 40002);
    }

    const plan = generatePlanFromGoal(goalText);
    sendSuccess(res, { plan });
  } catch (error) {
    next(error);
  }
});

export { plansRouter };
