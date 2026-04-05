import type { NutritionFoodCard, NutritionRecommendationResult } from '@/types/nutrition';

export interface NutritionSummaryViewModel {
  highlights: string[];
  description: string;
}

export interface NutritionMealViewModel {
  key: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  label: string;
  title: string;
  portions: string[];
  foods: string[];
  why: string;
  alternatives: string[];
  detail: string;
}

const MEAL_LABELS: Record<NutritionMealViewModel['key'], string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
};

const normalizeSentence = (value: string): string =>
  value
    .replace(/\s+/g, '')
    .replace(/[。；;]+$/g, '')
    .trim();

const splitSentence = (value: string): string[] =>
  normalizeSentence(value)
    .split(/[，。；;]/)
    .map((item) => item.trim())
    .filter(Boolean);

const extractQuantities = (value: string): string[] => {
  const matches = value.match(/\d+\s*(?:克|g|毫升|ml|个|杯|份|拳|根)/gi) ?? [];
  return Array.from(new Set(matches.map((item) => item.replace(/\s+/g, '')))).slice(0, 3);
};

const extractFoodMentions = (value: string, foods: NutritionFoodCard[]): string[] => {
  const normalized = normalizeSentence(value);
  const matches = foods
    .filter((food) => [food.name, ...food.aliases].some((alias) => normalized.includes(alias)))
    .map((food) => food.name);

  return Array.from(new Set(matches)).slice(0, 4);
};

const trimMealPrefix = (value: string): string =>
  value
    .replace(/^(早餐|午餐|晚餐|加餐)(可|建议|推荐)?(安排|食用|选择)?/, '')
    .replace(/^可/, '')
    .replace(/^[：:]/, '')
    .trim();

const compactPhrase = (value: string): string =>
  value
    .replace(/^(根据您的|根据你的)/, '')
    .replace(/(建议|优先|帮助|并|同时)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildNutritionSummaryViewModel = (result: NutritionRecommendationResult): NutritionSummaryViewModel => {
  const summaryParts = splitSentence(result.summary).map(compactPhrase).filter(Boolean);
  const tipHighlights = result.tips.map(compactPhrase).filter(Boolean);

  return {
    highlights: Array.from(new Set([...tipHighlights, ...summaryParts])).slice(0, 4),
    description: result.summary
  };
};

export const buildNutritionMealViewModels = (
  meals: NutritionRecommendationResult['meals'],
  referencedFoods: NutritionFoodCard[]
): NutritionMealViewModel[] => {
  return (Object.keys(meals) as Array<keyof typeof meals>).map((key) => {
    const meal = meals[key];
    const title = trimMealPrefix(meal.title);
    const detail = meal.detail || meal.why;
    const suggestedFoods =
      meal.suggestedFoods.length > 0 ? meal.suggestedFoods : extractFoodMentions(`${meal.title}${meal.detail}`, referencedFoods);

    return {
      key,
      label: MEAL_LABELS[key],
      title,
      portions: meal.suggestedPortions.length > 0 ? meal.suggestedPortions : extractQuantities(`${meal.detail} ${meal.why}`),
      foods: suggestedFoods,
      why: meal.why,
      alternatives: meal.alternatives,
      detail
    };
  });
};
