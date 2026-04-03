import type { PlanStreamEvent } from '@/types/plan';

const PLAN_GENERATION_SESSION_KEY = 'fitmirror_plan_generation_session';

export type PlanGenerationSessionStatus = 'pending' | 'completed' | 'error';

export interface PlanGenerationSessionSnapshot {
  userId: number;
  goalText: string;
  status: PlanGenerationSessionStatus;
  progressState: PlanStreamEvent['type'] | null;
  errorMessage: string;
  updatedAt: string;
}

const isValidProgressState = (value: unknown): value is PlanStreamEvent['type'] | null =>
  value === null ||
  value === 'queued' ||
  value === 'llm_start' ||
  value === 'llm_done' ||
  value === 'llm_failed' ||
  value === 'fallback_start' ||
  value === 'completed';

export const loadPlanGenerationSession = (): PlanGenerationSessionSnapshot | null => {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(PLAN_GENERATION_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PlanGenerationSessionSnapshot>;
    if (
      typeof parsed.userId !== 'number' ||
      !Number.isFinite(parsed.userId) ||
      typeof parsed.goalText !== 'string' ||
      (parsed.status !== 'pending' && parsed.status !== 'completed' && parsed.status !== 'error') ||
      !isValidProgressState(parsed.progressState) ||
      typeof parsed.errorMessage !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      goalText: parsed.goalText,
      status: parsed.status,
      progressState: parsed.progressState,
      errorMessage: parsed.errorMessage,
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
};

export const savePlanGenerationSession = (snapshot: PlanGenerationSessionSnapshot): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.setItem(PLAN_GENERATION_SESSION_KEY, JSON.stringify(snapshot));
};

export const clearPlanGenerationSession = (): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.removeItem(PLAN_GENERATION_SESSION_KEY);
};
