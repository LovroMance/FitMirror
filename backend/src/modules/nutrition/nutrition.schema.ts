import { HttpError } from '../../utils/http-error';
import type { NutritionGoal, NutritionPreference, RecommendNutritionInput } from './nutrition.types';

const GOALS: NutritionGoal[] = ['fat_loss', 'muscle_gain', 'maintenance'];
const PREFERENCES: NutritionPreference[] = ['high_protein', 'low_oil', 'light', 'quick'];
const MAX_NOTE_LENGTH = 200;

const isGoal = (value: unknown): value is NutritionGoal => typeof value === 'string' && GOALS.includes(value as NutritionGoal);

const isPreference = (value: unknown): value is NutritionPreference =>
  typeof value === 'string' && PREFERENCES.includes(value as NutritionPreference);

export const parseRecommendNutritionBody = (body: unknown): RecommendNutritionInput => {
  const payload = body as Record<string, unknown>;
  const goal = payload.goal;
  const preferences = payload.preferences;
  const note = String(payload.note ?? '').trim();

  if (!isGoal(goal)) {
    throw new HttpError('goal is invalid', 400, 40031);
  }

  if (!Array.isArray(preferences)) {
    throw new HttpError('preferences must be an array', 400, 40032);
  }

  const normalizedPreferences = preferences.filter((item): item is NutritionPreference => isPreference(item));
  if (normalizedPreferences.length !== preferences.length) {
    throw new HttpError('preferences contain invalid value', 400, 40033);
  }

  if (note.length > MAX_NOTE_LENGTH) {
    throw new HttpError('note is too long', 400, 40034);
  }

  return {
    goal,
    preferences: Array.from(new Set(normalizedPreferences)),
    note
  };
};
