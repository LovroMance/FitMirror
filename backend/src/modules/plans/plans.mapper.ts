import type { Response } from 'express';
import type { GeneratePlanResult, PlanProgressEvent } from './plans.service';

export const toGeneratePlanResponse = (result: GeneratePlanResult) => ({
  plan: result.plan,
  source: result.source
});

export const writeSseEvent = (
  res: Response,
  event: string,
  payload: Record<string, unknown>
): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const toProgressPayload = (event: PlanProgressEvent): Record<string, unknown> => ({
  type: event.type,
  ...(event.source ? { source: event.source } : {}),
  ...(event.reason ? { reason: event.reason } : {}),
  ...(event.plan ? { plan: event.plan } : {})
});
