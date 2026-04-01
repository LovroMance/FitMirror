import { HttpError } from '../../utils/http-error';

interface PlanExerciseLike {
  name?: unknown;
  instruction?: unknown;
  restSeconds?: unknown;
  reps?: unknown;
  durationSeconds?: unknown;
}

interface TrainingPlanLike {
  title?: unknown;
  level?: unknown;
  durationMinutes?: unknown;
  summary?: unknown;
  exercises?: unknown;
}

export interface PlanSyncInput {
  clientPlanId: string;
  goalText: string;
  planJson: TrainingPlanLike;
  createdAt: string;
  updatedAt: string;
}

export interface SyncPlansBody {
  plans: PlanSyncInput[];
  deletedClientPlanIds: string[];
}

const isIsoDateString = (value: string): boolean => !Number.isNaN(Date.parse(value));

const isValidPlanJson = (value: unknown): value is TrainingPlanLike => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const plan = value as TrainingPlanLike;
  if (
    typeof plan.title !== 'string' ||
    typeof plan.summary !== 'string' ||
    typeof plan.durationMinutes !== 'number' ||
    !Number.isFinite(plan.durationMinutes) ||
    !Array.isArray(plan.exercises)
  ) {
    return false;
  }

  return plan.exercises.every((exercise) => {
    if (typeof exercise !== 'object' || exercise === null) {
      return false;
    }

    const item = exercise as PlanExerciseLike;
    return (
      typeof item.name === 'string' &&
      typeof item.instruction === 'string' &&
      typeof item.restSeconds === 'number' &&
      Number.isFinite(item.restSeconds) &&
      (typeof item.reps === 'string' || typeof item.durationSeconds === 'number')
    );
  });
};

const parseOnePlan = (value: unknown): PlanSyncInput => {
  const payload = value as Record<string, unknown>;
  const clientPlanId = String(payload.clientPlanId ?? '').trim();
  const goalText = String(payload.goalText ?? '').trim();
  const createdAt = String(payload.createdAt ?? '').trim();
  const updatedAt = String(payload.updatedAt ?? '').trim();
  const planJson = payload.planJson;

  if (!clientPlanId || !goalText || !createdAt || !updatedAt || !isValidPlanJson(planJson)) {
    throw new HttpError('Invalid plan sync payload', 400, 40021);
  }

  if (!isIsoDateString(createdAt) || !isIsoDateString(updatedAt)) {
    throw new HttpError('Invalid plan sync dates', 400, 40022);
  }

  return {
    clientPlanId,
    goalText,
    planJson,
    createdAt,
    updatedAt
  };
};

export const parseSyncPlansBody = (body: unknown): SyncPlansBody => {
  const payload = body as Record<string, unknown>;
  const plans = Array.isArray(payload.plans) ? payload.plans.map((item) => parseOnePlan(item)) : null;
  const deletedClientPlanIds = Array.isArray(payload.deletedClientPlanIds)
    ? payload.deletedClientPlanIds.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0)
    : [];

  if (!plans) {
    throw new HttpError('Invalid plans payload', 400, 40020);
  }

  return { plans, deletedClientPlanIds };
};
