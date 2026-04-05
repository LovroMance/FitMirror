import axios from 'axios';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import type {
  NutritionFood,
  NutritionFoodCard,
  NutritionGoal,
  NutritionGuideline,
  NutritionPreference,
  NutritionRecommendationMeals,
  NutritionRecommendationResult,
  RecommendNutritionInput
} from './nutrition.types';

interface RetrievedGuideline extends NutritionGuideline {
  score: number;
}

interface NutritionLlmPayload {
  summary?: unknown;
  meals?: unknown;
  tips?: unknown;
  referencedFoodNames?: unknown;
}

let guidelinesCache: NutritionGuideline[] | null = null;
let foodsCache: NutritionFood[] | null = null;

const MEAL_ORDER: Array<keyof NutritionRecommendationMeals> = ['breakfast', 'lunch', 'dinner', 'snack'];
const GOAL_LABEL_MAP: Record<NutritionGoal, string> = {
  fat_loss: '减脂',
  muscle_gain: '增肌',
  maintenance: '保持'
};
const PREFERENCE_LABEL_MAP: Record<NutritionPreference, string> = {
  high_protein: '高蛋白',
  low_oil: '少油',
  light: '清淡',
  quick: '快手省时'
};

const loadJsonFile = <T>(fileName: string): T => {
  const runtimePath = path.join(__dirname, 'data', fileName);
  const sourcePath = path.join(process.cwd(), 'src', 'modules', 'nutrition', 'data', fileName);
  const filePath = existsSync(runtimePath) ? runtimePath : sourcePath;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
};

const loadGuidelines = (): NutritionGuideline[] => {
  if (!guidelinesCache) {
    guidelinesCache = loadJsonFile<NutritionGuideline[]>('nutrition-guidelines.json');
  }

  return guidelinesCache;
};

const loadFoods = (): NutritionFood[] => {
  if (!foodsCache) {
    foodsCache = loadJsonFile<NutritionFood[]>('nutrition-foods.json');
  }

  return foodsCache;
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[\s,，。；;、/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const containsAvoidance = (source: string, avoidances: string): boolean => {
  const normalizedAvoidances = avoidances.trim().toLowerCase();
  if (!normalizedAvoidances) {
    return false;
  }

  return tokenize(normalizedAvoidances).some((token) => token && source.toLowerCase().includes(token));
};

const scoreGuideline = (
  guideline: NutritionGuideline,
  goal: NutritionGoal,
  preferences: NutritionPreference[],
  avoidances: string
): number => {
  if (containsAvoidance(`${guideline.title} ${guideline.summary} ${guideline.content}`, avoidances)) {
    return -1;
  }

  if (!guideline.goalTags.includes(goal)) {
    return 0;
  }

  let score = 8 + guideline.priority;

  preferences.forEach((preference) => {
    if (guideline.preferenceTags.includes(preference)) {
      score += 4;
    }
  });

  const preferenceKeywords = preferences.map((preference) => PREFERENCE_LABEL_MAP[preference]).join(' ');
  const keywordText = `${GOAL_LABEL_MAP[goal]} ${preferenceKeywords}`.trim().toLowerCase();
  guideline.keywords.forEach((keyword) => {
    if (keywordText.includes(keyword.toLowerCase())) {
      score += 1;
    }
  });

  return score;
};

const retrieveGuidelines = (input: RecommendNutritionInput): RetrievedGuideline[] => {
  return loadGuidelines()
    .map((guideline) => ({
      ...guideline,
      score: scoreGuideline(guideline, input.goal, input.preferences, input.avoidances)
    }))
    .filter((guideline) => guideline.score > 0)
    .sort((left, right) => right.score - left.score || right.priority - left.priority)
    .slice(0, 6);
};

const buildFoodQueryText = (guidelines: RetrievedGuideline[], avoidances: string): string =>
  [
    ...guidelines.flatMap((guideline) => [guideline.title, guideline.summary, guideline.content, ...guideline.keywords]),
    avoidances
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const retrieveFoods = (guidelines: RetrievedGuideline[], avoidances: string): NutritionFoodCard[] => {
  const queryText = buildFoodQueryText(guidelines, avoidances);

  return loadFoods()
    .map((food) => {
      if (containsAvoidance([food.name, ...food.aliases, ...food.keywords].join(' '), avoidances)) {
        return { food, score: -1 };
      }

      let score = 0;
      [food.name, ...food.aliases, ...food.keywords].forEach((keyword) => {
        if (queryText.includes(keyword.toLowerCase())) {
          score += 3;
        }
      });

      return { food, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => item.food);
};

const stripJsonCodeFence = (content: string): string =>
  content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

const extractContentText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (typeof item === 'object' && item !== null) {
          const payload = item as Record<string, unknown>;
          if (typeof payload.text === 'string') {
            return payload.text;
          }
        }

        return '';
      })
      .join('\n');
  }

  return '';
};

const safeParseJson = (content: string): NutritionLlmPayload | null => {
  try {
    return JSON.parse(content) as NutritionLlmPayload;
  } catch {
    return null;
  }
};

const toShortText = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeMeals = (value: unknown): NutritionRecommendationMeals | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const meals: NutritionRecommendationMeals = {
    breakfast: toShortText(payload.breakfast, ''),
    lunch: toShortText(payload.lunch, ''),
    dinner: toShortText(payload.dinner, ''),
    snack: toShortText(payload.snack, '')
  };

  if (MEAL_ORDER.some((key) => !meals[key])) {
    return null;
  }

  return meals;
};

const normalizeTips = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
};

const matchFoodByName = (foodName: string, foods: NutritionFood[]): NutritionFoodCard | null => {
  const normalized = foodName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    foods.find((food) => food.name.toLowerCase() === normalized) ??
    foods.find((food) => food.aliases.some((alias) => alias.toLowerCase() === normalized)) ??
    null
  );
};

const normalizeReferencedFoods = (value: unknown, fallbackFoods: NutritionFoodCard[]): NutritionFoodCard[] => {
  if (!Array.isArray(value)) {
    return fallbackFoods.slice(0, 4);
  }

  const resolved = value
    .filter((item): item is string => typeof item === 'string')
    .map((name) => matchFoodByName(name, loadFoods()))
    .filter((item): item is NutritionFoodCard => item !== null);

  if (resolved.length > 0) {
    return Array.from(new Map(resolved.map((food) => [food.id, food])).values()).slice(0, 4);
  }

  return fallbackFoods.slice(0, 4);
};

const buildPrompt = (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): string => {
  const guidelineText = guidelines
    .map(
      (guideline, index) =>
        `${index + 1}. 标题：${guideline.title}\n适用餐次：${guideline.mealTypes.join('、')}\n摘要：${guideline.summary}\n说明：${guideline.content}`
    )
    .join('\n\n');

  const foodText = foods
    .map(
      (food, index) =>
        `${index + 1}. ${food.name}（每 ${food.unit}：蛋白质 ${food.nutritionPer100g.proteinG}g，碳水 ${food.nutritionPer100g.carbohydrateG}g，脂肪 ${food.nutritionPer100g.fatG}g，膳食纤维 ${food.nutritionPer100g.fiberG}g，热量 ${food.nutritionPer100g.energyKcal}kcal）`
    )
    .join('\n');

  return [
    '请基于系统提供的饮食知识和食物营养信息，为用户生成 1 天饮食建议。',
    '必须优先依据系统知识，不要给出医疗诊断、药物建议、极端节食建议。',
    '只返回合法 JSON，不要返回 markdown，不要额外解释。',
    'JSON 字段必须包含：summary, meals, tips, referencedFoodNames。',
    'meals 必须包含 breakfast, lunch, dinner, snack 四个字段，值为中文完整句子。',
    'tips 必须是 2 到 4 条中文建议。',
    'referencedFoodNames 必须是系统已提供食物名称组成的数组。',
    `用户目标：${GOAL_LABEL_MAP[input.goal]}`,
    `用户偏好：${input.preferences.length > 0 ? input.preferences.map((item) => PREFERENCE_LABEL_MAP[item]).join('、') : '无特殊偏好'}`,
    `忌口或限制：${input.avoidances || '无'}`,
    '系统饮食知识：',
    guidelineText,
    '系统食物营养信息：',
    foodText
  ].join('\n');
};

const callDeepSeekForNutrition = async (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): Promise<NutritionRecommendationResult> => {
  if (!env.deepseekApiKey) {
    throw new Error('营养推荐服务暂不可用，请稍后再试');
  }

  const response = await axios.post<{
    choices?: Array<{ message?: { content?: unknown } }>;
  }>(
    `${env.deepseekBaseUrl}/chat/completions`,
    {
      model: env.deepseekModel,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            '你是 FitMirror 的饮食推荐助手。必须优先遵守系统提供的知识和营养数据，只输出合法 JSON。'
        },
        {
          role: 'user',
          content: buildPrompt(input, guidelines, foods)
        }
      ]
    },
    {
      timeout: env.deepseekTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.deepseekApiKey}`
      }
    }
  );

  const content = response.data.choices?.[0]?.message?.content;
  const text = stripJsonCodeFence(extractContentText(content));
  const parsed = text ? safeParseJson(text) : null;
  const meals = parsed ? normalizeMeals(parsed.meals) : null;

  if (!parsed || !meals) {
    throw new Error('营养推荐结果解析失败，请稍后重试');
  }

  const tips = normalizeTips(parsed.tips);
  if (tips.length < 2) {
    throw new Error('营养推荐结果不完整，请稍后重试');
  }

  return {
    summary: toShortText(parsed.summary, '建议优先保证三餐结构清晰、蛋白质充足并控制加工食品摄入。'),
    meals,
    tips,
    referencedFoods: normalizeReferencedFoods(parsed.referencedFoodNames, foods),
    knowledgeMeta: {
      guidelineCount: guidelines.length,
      foodCount: foods.length
    }
  };
};

export const recommendNutrition = async (input: RecommendNutritionInput): Promise<NutritionRecommendationResult> => {
  const guidelines = retrieveGuidelines(input);
  if (guidelines.length === 0) {
    throw new HttpError('未找到适合当前目标的饮食知识，请调整条件后重试', 400, 40035);
  }

  const foods = retrieveFoods(guidelines, input.avoidances);
  if (foods.length === 0) {
    throw new Error('暂无可用食物营养信息，请稍后重试');
  }

  return callDeepSeekForNutrition(input, guidelines, foods);
};
