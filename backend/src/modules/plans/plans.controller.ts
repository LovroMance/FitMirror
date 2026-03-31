import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../utils/http-error';
import { sendSuccess } from '../../utils/response';
import { generatePlanWithFallback, type PlanProgressEvent } from './plans.service';
import { toGeneratePlanResponse, toProgressPayload, writeSseEvent } from './plans.mapper';
import { parseGeneratePlanBody, parseGeneratePlanQuery } from './plans.schema';

export const generatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { goalText } = parseGeneratePlanBody(req.body);
    const result = await generatePlanWithFallback(goalText);
    res.setHeader('X-Plan-Source', result.source);
    sendSuccess(res, toGeneratePlanResponse(result));
  } catch (error) {
    next(error);
  }
};

export const streamGeneratedPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { goalText } = parseGeneratePlanQuery(req.query);

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

      writeSseEvent(res, event.type, toProgressPayload(event));
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
};
