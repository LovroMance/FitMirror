import { HttpError } from '../../utils/http-error';

export interface GeneratePlanInput {
  goalText: string;
}

const resolveGoalText = (rawValue: unknown): string => String(rawValue ?? '').trim();

const validateGoalText = (goalText: string): void => {
  if (!goalText) {
    throw new HttpError('goalText is required', 400, 40001);
  }

  if (goalText.length > 500) {
    throw new HttpError('goalText is too long', 400, 40002);
  }
};

export const parseGeneratePlanBody = (body: unknown): GeneratePlanInput => {
  const payload = body as Record<string, unknown>;
  const goalText = resolveGoalText(payload.goalText);
  validateGoalText(goalText);

  return { goalText };
};

export const parseGeneratePlanQuery = (query: unknown): GeneratePlanInput => {
  const payload = query as Record<string, unknown>;
  const goalText = resolveGoalText(payload.goalText);
  validateGoalText(goalText);

  return { goalText };
};
