import type { ExerciseFilters, ExerciseItem } from '@/types/exercise';

const normalize = (value: string): string => value.trim().toLowerCase();
const normalizeCompact = (value: string): string => normalize(value).replace(/[\s()（）\-—_]+/g, '');
const stripCommonPrefixes = (value: string): string =>
  value.replace(/^(动态热身|热身|放松|静态拉伸|拉伸|原地)/, '').trim();

const deriveKeywordVariants = (value: string): string[] => {
  const raw = normalize(value);
  const compact = normalizeCompact(value);
  const withoutBrackets = raw.replace(/[（(].*?[)）]/g, '').trim();
  const segments = raw.split(/[/、\-—]/).map((item) => item.trim()).filter(Boolean);
  const variants = new Set<string>([raw, compact]);

  [withoutBrackets, stripCommonPrefixes(withoutBrackets), ...segments, ...segments.map(stripCommonPrefixes)].forEach(
    (item) => {
      const normalizedItem = normalize(item);
      const compactItem = normalizeCompact(item);

      if (normalizedItem) {
        variants.add(normalizedItem);
      }

      if (compactItem) {
        variants.add(compactItem);
      }
    }
  );

  return [...variants].filter(Boolean);
};

export const filterExercises = (items: ExerciseItem[], filters: ExerciseFilters): ExerciseItem[] => {
  const keywordVariants = deriveKeywordVariants(filters.keyword);

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

    if (keywordVariants.length === 0) {
      return true;
    }

    const candidates = [item.name, item.description, item.bodyPart, item.level, item.equipment, ...item.tags].join(' ');
    const normalizedCandidates = normalize(candidates);
    const compactCandidates = normalizeCompact(candidates);

    return keywordVariants.some(
      (keyword) => normalizedCandidates.includes(keyword) || compactCandidates.includes(keyword)
    );
  });
};
