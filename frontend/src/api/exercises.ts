import type {
  ExerciseBodyPart,
  ExerciseEquipment,
  ExerciseItem,
  ExerciseLevel
} from '@/types/exercise';

const VALID_BODY_PARTS: ExerciseBodyPart[] = ['core', 'upper', 'lower', 'full_body', 'mobility'];
const VALID_LEVELS: ExerciseLevel[] = ['beginner', 'intermediate', 'advanced'];
const VALID_EQUIPMENT: ExerciseEquipment[] = ['none', 'mat', 'dumbbell', 'band', 'chair'];

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const sanitizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];

const sanitizeExercise = (value: unknown): ExerciseItem | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Partial<ExerciseItem>;

  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.name)) {
    return null;
  }

  if (!VALID_BODY_PARTS.includes(raw.bodyPart as ExerciseBodyPart)) {
    return null;
  }

  if (!VALID_LEVELS.includes(raw.level as ExerciseLevel)) {
    return null;
  }

  if (!VALID_EQUIPMENT.includes(raw.equipment as ExerciseEquipment)) {
    return null;
  }

  if (!Number.isFinite(raw.durationMinutes) || (raw.durationMinutes ?? 0) <= 0) {
    return null;
  }

  if (!Number.isFinite(raw.sets) || (raw.sets ?? 0) <= 0) {
    return null;
  }

  const instructions = sanitizeStringArray(raw.instructions);
  const tips = sanitizeStringArray(raw.tips);

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    bodyPart: raw.bodyPart as ExerciseBodyPart,
    level: raw.level as ExerciseLevel,
    equipment: raw.equipment as ExerciseEquipment,
    durationMinutes: Number(raw.durationMinutes),
    sets: Number(raw.sets),
    reps: isNonEmptyString(raw.reps) ? raw.reps.trim() : '按体能完成',
    description: isNonEmptyString(raw.description) ? raw.description.trim() : '暂无动作描述',
    instructions: instructions.length > 0 ? instructions : ['暂无动作要点'],
    tips: tips.length > 0 ? tips : ['暂无注意事项'],
    tags: sanitizeStringArray(raw.tags)
  };
};

export const fetchExercises = async (): Promise<ExerciseItem[]> => {
  const response = await fetch('/data/exercises.json', { method: 'GET' });

  if (!response.ok) {
    throw new Error('动作库数据加载失败，请稍后重试');
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('动作库数据格式错误，请稍后重试');
  }

  const sanitized = data
    .map((item) => sanitizeExercise(item))
    .filter((item): item is ExerciseItem => item !== null);

  if (sanitized.length === 0) {
    throw new Error('动作库暂无可用数据');
  }

  return sanitized;
};
