import type { PlanEditingSessionSnapshot } from '@/types/plan';

const PLAN_EDITING_SESSION_STORAGE_KEY = 'fitmirror_plan_editing_session';

export const savePlanEditingSession = (snapshot: PlanEditingSessionSnapshot): void => {
  sessionStorage.setItem(PLAN_EDITING_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
};

export const loadPlanEditingSession = (): PlanEditingSessionSnapshot | null => {
  const rawSnapshot = sessionStorage.getItem(PLAN_EDITING_SESSION_STORAGE_KEY);
  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as PlanEditingSessionSnapshot;
  } catch {
    return null;
  }
};

export const clearPlanEditingSession = (): void => {
  sessionStorage.removeItem(PLAN_EDITING_SESSION_STORAGE_KEY);
};
