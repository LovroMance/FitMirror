import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import {
  type PlanProgressEvent,
  generatePlanWithFallback
} from './plans.service';

const plansRouter = Router();

const resolveGoalText = (rawValue: unknown): string => String(rawValue ?? '').trim();

const validateGoalText = (goalText: string): void => {
  if (!goalText) {
    throw new HttpError('goalText is required', 400, 40001);
  }

  if (goalText.length > 500) {
    throw new HttpError('goalText is too long', 400, 40002);
  }
};

const writeSseEvent = (res: Response, event: string, payload: Record<string, unknown>): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

plansRouter.post('/generate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalText = resolveGoalText(req.body.goalText);
    validateGoalText(goalText);

    const result = await generatePlanWithFallback(goalText);
    res.setHeader('X-Plan-Source', result.source);
    sendSuccess(res, { plan: result.plan, source: result.source });
  } catch (error) {
    next(error);
  }
});

plansRouter.get('/generate/stream', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalText = resolveGoalText(req.query.goalText);
    validateGoalText(goalText);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });

    const emit = (event: PlanProgressEvent): void => {
      if (clientClosed) {
        return;
      }

      writeSseEvent(res, event.type, {
        type: event.type,
        ...(event.source ? { source: event.source } : {}),
        ...(event.reason ? { reason: event.reason } : {}),
        ...(event.plan ? { plan: event.plan } : {})
      });
    };

    await generatePlanWithFallback(goalText, emit);

    if (!clientClosed) {
      res.end();
    }
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;

    if (statusCode >= 400 && statusCode < 500) {
      next(error);
      return;
    }

    try {
      writeSseEvent(res, 'error', {
        type: 'error',
        message: '计划生成失败，请稍后重试'
      });
      res.end();
    } catch {
      next(error);
    }
  }
});

export { plansRouter };
