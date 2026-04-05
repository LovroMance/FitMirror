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

type NutritionLlmFailureReason =
  | 'missing_api_key'
  | 'timeout'
  | 'auth'
  | 'network'
  | 'provider_server'
  | 'provider_client'
  | 'invalid_response'
  | 'unknown';

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
const RETRYABLE_LLM_FAILURE_REASONS = new Set<NutritionLlmFailureReason>([
  'timeout',
  'network',
  'provider_server',
  'invalid_response',
  'unknown'
]);

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

const extractRestrictionTokens = (note: string): string[] => {
  const normalized = note.trim();
  if (!normalized) {
    return [];
  }

  const restrictedMatches = Array.from(
    normalized.matchAll(/(?:不吃|不要|不想吃|不能吃|忌口|过敏|乳糖不耐受)([^，。；;、\s]+)/g)
  )
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);

  return Array.from(new Set(restrictedMatches));
};

const containsRestriction = (source: string, note: string): boolean => {
  const restrictionTokens = extractRestrictionTokens(note);
  if (restrictionTokens.length === 0) {
    return false;
  }

  return restrictionTokens.some((token) => token && source.toLowerCase().includes(token.toLowerCase()));
};

const scoreGuideline = (
  guideline: NutritionGuideline,
  goal: NutritionGoal,
  preferences: NutritionPreference[],
  note: string
): number => {
  if (containsRestriction(`${guideline.title} ${guideline.summary} ${guideline.content}`, note)) {
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
  const queryText = `${input.note} ${GOAL_LABEL_MAP[input.goal]} ${input.preferences.map((item) => PREFERENCE_LABEL_MAP[item]).join(' ')}`
    .trim()
    .toLowerCase();

  return loadGuidelines()
    .map((guideline) => ({
      ...guideline,
      score:
        scoreGuideline(guideline, input.goal, input.preferences, input.note) +
        guideline.keywords.reduce(
          (total, keyword) => (queryText.includes(keyword.toLowerCase()) ? total + 1 : total),
          0
        )
    }))
    .filter((guideline) => guideline.score > 0)
    .sort((left, right) => right.score - left.score || right.priority - left.priority)
    .slice(0, 6);
};

const buildFoodQueryText = (guidelines: RetrievedGuideline[], note: string): string =>
  [
    ...guidelines.flatMap((guideline) => [guideline.title, guideline.summary, guideline.content, ...guideline.keywords]),
    note
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const retrieveFoods = (guidelines: RetrievedGuideline[], note: string): NutritionFoodCard[] => {
  const queryText = buildFoodQueryText(guidelines, note);

  return loadFoods()
    .map((food) => {
      if (containsRestriction([food.name, ...food.aliases, ...food.keywords].join(' '), note)) {
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

const classifyNutritionLlmFailure = (error: unknown): NutritionLlmFailureReason => {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && /解析失败|结果不完整/.test(error.message)) {
      return 'invalid_response';
    }

    return 'unknown';
  }

  if (error.code === 'ECONNABORTED') {
    return 'timeout';
  }

  const status = error.response?.status;
  if (status === 401 || status === 403) {
    return 'auth';
  }

  if (typeof status === 'number' && status >= 500) {
    return 'provider_server';
  }

  if (typeof status === 'number' && status >= 400) {
    return 'provider_client';
  }

  if (!error.response) {
    return 'network';
  }

  return 'unknown';
};

const logNutritionRecommendation = (meta: {
  goal: NutritionGoal;
  source: 'llm' | 'fallback';
  durationMs: number;
  failureReason?: NutritionLlmFailureReason;
}): void => {
  const payload = {
    event: 'nutrition_recommendation',
    goal: meta.goal,
    source: meta.source,
    durationMs: meta.durationMs,
    ...(meta.failureReason ? { failureReason: meta.failureReason } : {})
  };

  if (meta.failureReason) {
    console.warn('[FitMirror]', payload);
    return;
  }

  console.info('[FitMirror]', payload);
};

const pickFoodByCategory = (
  foods: NutritionFoodCard[],
  category: NutritionFood['category'],
  excludedIds: string[] = []
): NutritionFoodCard | null =>
  foods.find((food) => food.category === category && !excludedIds.includes(food.id)) ?? null;

const pickFoodById = (foods: NutritionFoodCard[], ids: string[]): NutritionFoodCard | null =>
  ids.map((id) => foods.find((food) => food.id === id) ?? null).find((food): food is NutritionFoodCard => food !== null) ?? null;

const joinFoodNames = (foods: Array<NutritionFoodCard | null>): string =>
  foods
    .filter((food): food is NutritionFoodCard => food !== null)
    .map((food) => food.name)
    .join('、');

const buildFallbackSummary = (goal: NutritionGoal, guidelines: RetrievedGuideline[]): string => {
  const summaryText = guidelines
    .slice(0, 2)
    .map((guideline) => guideline.summary.replace(/。$/, ''))
    .filter(Boolean)
    .join('，');

  if (summaryText) {
    return `${GOAL_LABEL_MAP[goal]}阶段先按稳定、易执行的结构安排三餐。${summaryText}。`;
  }

  return `${GOAL_LABEL_MAP[goal]}阶段建议优先保证三餐规律、蛋白质充足，并用清晰的主食和蔬菜搭配提升执行稳定性。`;
};

const buildFallbackMeals = (
  goal: NutritionGoal,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): NutritionRecommendationMeals => {
  const staple = pickFoodById(foods, ['food-oats', 'food-rice-cooked']) ?? pickFoodByCategory(foods, 'staple');
  const rice = pickFoodById(foods, ['food-rice-cooked']) ?? staple;
  const oats = pickFoodById(foods, ['food-oats']) ?? staple;
  const chicken = pickFoodById(foods, ['food-chicken-breast']) ?? pickFoodByCategory(foods, 'protein');
  const salmon = pickFoodById(foods, ['food-salmon']) ?? chicken;
  const egg = pickFoodById(foods, ['food-egg']) ?? chicken;
  const milk = pickFoodById(foods, ['food-milk']) ?? pickFoodByCategory(foods, 'dairy');
  const fruit = pickFoodById(foods, ['food-banana', 'food-blueberry']) ?? pickFoodByCategory(foods, 'fruit');
  const vegetable = pickFoodById(foods, ['food-broccoli']) ?? pickFoodByCategory(foods, 'vegetable');

  const lunchCarbPortion = goal === 'fat_loss' ? '少量' : '适量';
  const dinnerCarbPortion = goal === 'muscle_gain' ? '适量' : '少量';
  const breakfastGuide = guidelines.find((guideline) => guideline.mealTypes.includes('breakfast'))?.summary;
  const lunchGuide = guidelines.find((guideline) => guideline.mealTypes.includes('lunch'))?.summary;
  const dinnerGuide = guidelines.find((guideline) => guideline.mealTypes.includes('dinner'))?.summary;
  const snackGuide = guidelines.find((guideline) => guideline.mealTypes.includes('snack'))?.summary;

  return {
    breakfast: `${breakfastGuide || '早餐先保证稳定能量和蛋白质摄入。'} 可安排 ${joinFoodNames([oats, egg, milk, fruit])} 作为基础组合。`,
    lunch: `${lunchGuide || '午餐以主食、蛋白质和蔬菜的清晰搭配为主。'} 建议用 ${lunchCarbPortion}${joinFoodNames([rice])} 搭配 ${joinFoodNames([chicken, vegetable])}。`,
    dinner: `${dinnerGuide || '晚餐保持清晰结构，避免高油高糖。'} 可用 ${joinFoodNames([salmon, vegetable])}${
      rice ? `，并配 ${dinnerCarbPortion}${rice.name}` : ''
    }。`,
    snack: `${snackGuide || '加餐尽量简单好执行。'} 可选择 ${joinFoodNames([fruit, milk]) || joinFoodNames([fruit, egg])}。`
  };
};

const buildFallbackTips = (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): string[] => {
  const tips = [
    guidelines[0]?.content,
    input.preferences.includes('quick')
      ? '时间紧张时先保证结构正确，优先选择鸡蛋、牛奶、水果和可快速加热的主食。'
      : '',
    input.preferences.includes('low_oil')
      ? '本次建议优先采用蒸、煮、焯、烤等少油做法，减少额外烹调用油。'
      : '',
    foods[0]?.benefits?.[0] ?? ''
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(tips)).slice(0, 4);
};

const buildFallbackNutritionResult = (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): NutritionRecommendationResult => ({
  summary: buildFallbackSummary(input.goal, guidelines),
  meals: buildFallbackMeals(input.goal, guidelines, foods),
  tips: buildFallbackTips(input, guidelines, foods),
  referencedFoods: foods.slice(0, 4),
  knowledgeMeta: {
    guidelineCount: guidelines.length,
    foodCount: foods.length,
    source: 'fallback'
  }
});

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
    `用户补充要求或问题：${input.note || '无'}`,
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
      foodCount: foods.length,
      source: 'llm'
    }
  };
};

const callDeepSeekForNutritionWithRetry = async (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): Promise<{ result: NutritionRecommendationResult | null; failureReason?: NutritionLlmFailureReason }> => {
  if (!env.deepseekApiKey) {
    return {
      result: null,
      failureReason: 'missing_api_key'
    };
  }

  let lastFailureReason: NutritionLlmFailureReason | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await callDeepSeekForNutrition(input, guidelines, foods);
      return {
        result
      };
    } catch (error) {
      lastFailureReason = classifyNutritionLlmFailure(error);
      if (attempt === 1 || !RETRYABLE_LLM_FAILURE_REASONS.has(lastFailureReason)) {
        break;
      }
    }
  }

  return {
    result: null,
    failureReason: lastFailureReason ?? 'unknown'
  };
};

export const recommendNutrition = async (input: RecommendNutritionInput): Promise<NutritionRecommendationResult> => {
  const startAt = Date.now();
  const guidelines = retrieveGuidelines(input);
  if (guidelines.length === 0) {
    throw new HttpError('未找到适合当前目标的饮食知识，请调整条件后重试', 400, 40035);
  }

  const foods = retrieveFoods(guidelines, input.note);
  if (foods.length === 0) {
    throw new Error('暂无可用食物营养信息，请稍后重试');
  }

  const llmResult = await callDeepSeekForNutritionWithRetry(input, guidelines, foods);
  if (llmResult.result) {
    logNutritionRecommendation({
      goal: input.goal,
      source: 'llm',
      durationMs: Date.now() - startAt
    });
    return llmResult.result;
  }

  const fallbackResult = buildFallbackNutritionResult(input, guidelines, foods);
  logNutritionRecommendation({
    goal: input.goal,
    source: 'fallback',
    durationMs: Date.now() - startAt,
    failureReason: llmResult.failureReason
  });
  return fallbackResult;
};
