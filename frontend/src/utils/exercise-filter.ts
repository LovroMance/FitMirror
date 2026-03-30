import type { ExerciseFilters, ExerciseItem } from '@/types/exercise';

const normalize = (value: string): string => value.trim().toLowerCase();

export const filterExercises = (items: ExerciseItem[], filters: ExerciseFilters): ExerciseItem[] => {
  const keyword = normalize(filters.keyword);

  return items.filter((item) => {
    if (filters.bodyPart !== 'all' && item.bodyPart !== filters.bodyPart) {
      return false;
    }

    if (filters.level !== 'all' && item.level !== filters.level) {
      return false;
    }

    if (filters.equipment !== 'all' && item.equipment !== filters.equipment) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const candidates = [item.name, item.description, item.bodyPart, item.level, item.equipment, ...item.tags]
      .join(' ')
      .toLowerCase();

    return candidates.includes(keyword);
  });
};
