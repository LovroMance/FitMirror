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
  NutritionMealRecommendation,
  NutritionNoteResponse,
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
  noteResponse?: unknown;
  meals?: unknown;
  tips?: unknown;
  referencedFoodNames?: unknown;
}

interface NoteSignals {
  type: NutritionNoteResponse['type'];
  normalized: string;
  questionKeywords: string[];
  lifestyleKeywords: string[];
  restrictionTokens: string[];
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
const QUESTION_KEYWORD_GROUPS = [
  {
    canonical: '减脂增肌区别',
    patterns: ['减脂和增肌', '减脂增肌', '区别', '不同', '差别']
  },
  {
    canonical: '工作日省时',
    patterns: ['工作日', '上班', '做饭时间少', '没时间', '时间少', '省时', '快手']
  },
  {
    canonical: '外卖应对',
    patterns: ['外卖', '食堂', '在外吃', '外食']
  },
  {
    canonical: '乳糖不耐受',
    patterns: ['乳糖不耐受', '不能喝牛奶', '乳制品不耐受']
  },
  {
    canonical: '不吃辣',
    patterns: ['不吃辣', '不要辣', '不能吃辣']
  },
  {
    canonical: '高蛋白安排',
    patterns: ['高蛋白', '蛋白质']
  }
] as const;
const LIFESTYLE_KEYWORD_GROUPS = [
  {
    canonical: '工作日省时',
    patterns: ['工作日', '上班', '做饭时间少', '没时间', '时间少', '省时', '快手']
  },
  {
    canonical: '外卖应对',
    patterns: ['外卖', '食堂', '在外吃', '外食']
  },
  {
    canonical: '乳糖不耐受',
    patterns: ['乳糖不耐受', '不能喝牛奶', '乳制品不耐受']
  },
  {
    canonical: '不吃辣',
    patterns: ['不吃辣', '不要辣', '不能吃辣']
  }
] as const;

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

const normalizeText = (value: string): string => value.trim().toLowerCase();

const collectMatchedKeywords = (
  text: string,
  groups: ReadonlyArray<{ canonical: string; patterns: readonly string[] }>
): string[] => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  return groups
    .filter((group) => group.patterns.some((pattern) => normalized.includes(pattern.toLowerCase())))
    .map((group) => group.canonical);
};

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

const detectNoteType = (note: string, restrictionTokens: string[]): NutritionNoteResponse['type'] => {
  const normalized = note.trim();
  if (!normalized) {
    return 'general';
  }

  const hasQuestion = /[？?]|什么|区别|不同|差别|怎么|如何|为什么|能不能|是否/.test(normalized);
  const hasConstraint =
    restrictionTokens.length > 0 || /不吃|不要|不能吃|忌口|过敏|乳糖不耐受|时间少|工作日|上班|外卖/.test(normalized);

  if (hasQuestion && hasConstraint) {
    return 'mixed';
  }

  if (hasQuestion) {
    return 'question';
  }

  if (hasConstraint) {
    return 'constraint';
  }

  return 'general';
};

const deriveNoteSignals = (note: string): NoteSignals => {
  const normalized = note.trim();
  const restrictionTokens = extractRestrictionTokens(normalized);

  return {
    type: detectNoteType(normalized, restrictionTokens),
    normalized,
    questionKeywords: collectMatchedKeywords(normalized, QUESTION_KEYWORD_GROUPS),
    lifestyleKeywords: collectMatchedKeywords(normalized, LIFESTYLE_KEYWORD_GROUPS),
    restrictionTokens
  };
};

const containsRestriction = (source: string, note: string): boolean => {
  const noteSignals = deriveNoteSignals(note);
  if (noteSignals.restrictionTokens.length === 0) {
    return false;
  }

  return noteSignals.restrictionTokens.some((token) => token && source.toLowerCase().includes(token.toLowerCase()));
};

const scoreGuideline = (
  guideline: NutritionGuideline,
  goal: NutritionGoal,
  preferences: NutritionPreference[],
  noteSignals: NoteSignals
): number => {
  if (noteSignals.restrictionTokens.length > 0 && containsRestriction(`${guideline.title} ${guideline.summary} ${guideline.content}`, noteSignals.normalized)) {
    return -1;
  }

  let score = guideline.goalTags.includes(goal) ? 8 + guideline.priority : 0;

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

  noteSignals.questionKeywords.forEach((keyword) => {
    if (guideline.keywords.some((item) => item.toLowerCase().includes(keyword.toLowerCase()))) {
      score += 6;
    }
    if (`${guideline.title} ${guideline.summary} ${guideline.content}`.toLowerCase().includes(keyword.toLowerCase())) {
      score += 3;
    }
  });

  noteSignals.lifestyleKeywords.forEach((keyword) => {
    if (guideline.keywords.some((item) => item.toLowerCase().includes(keyword.toLowerCase()))) {
      score += 4;
    }
    if (`${guideline.title} ${guideline.summary} ${guideline.content}`.toLowerCase().includes(keyword.toLowerCase())) {
      score += 2;
    }
  });

  return score;
};

const retrieveGuidelines = (input: RecommendNutritionInput): RetrievedGuideline[] => {
  const noteSignals = deriveNoteSignals(input.note);
  const queryText = `${input.note} ${GOAL_LABEL_MAP[input.goal]} ${input.preferences.map((item) => PREFERENCE_LABEL_MAP[item]).join(' ')} ${noteSignals.questionKeywords.join(' ')} ${noteSignals.lifestyleKeywords.join(' ')}`
    .trim()
    .toLowerCase();

  return loadGuidelines()
    .map((guideline) => ({
      ...guideline,
      score:
        scoreGuideline(guideline, input.goal, input.preferences, noteSignals) +
        guideline.keywords.reduce(
          (total, keyword) => (queryText.includes(keyword.toLowerCase()) ? total + 1 : total),
          0
        )
    }))
    .filter((guideline) => guideline.score > 0)
    .sort((left, right) => right.score - left.score || right.priority - left.priority)
    .slice(0, 6);
};

const buildFoodQueryText = (guidelines: RetrievedGuideline[], noteSignals: NoteSignals): string =>
  [
    ...guidelines.flatMap((guideline) => [guideline.title, guideline.summary, guideline.content, ...guideline.keywords]),
    noteSignals.normalized,
    ...noteSignals.questionKeywords,
    ...noteSignals.lifestyleKeywords
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const retrieveFoods = (guidelines: RetrievedGuideline[], note: string): NutritionFoodCard[] => {
  const noteSignals = deriveNoteSignals(note);
  const queryText = buildFoodQueryText(guidelines, noteSignals);

  return loadFoods()
    .map((food) => {
      if (noteSignals.restrictionTokens.length > 0 && containsRestriction([food.name, ...food.aliases, ...food.keywords].join(' '), noteSignals.normalized)) {
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

const normalizeStringArray = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeMealRecommendation = (value: unknown): NutritionMealRecommendation | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const title = toShortText(payload.title, '');
  const why = toShortText(payload.why, '');
  const detail = toShortText(payload.detail, why || title);

  if (!title || !why) {
    return null;
  }

  return {
    title,
    suggestedFoods: normalizeStringArray(payload.suggestedFoods, 5),
    suggestedPortions: normalizeStringArray(payload.suggestedPortions, 4),
    why,
    alternatives: normalizeStringArray(payload.alternatives, 4),
    detail
  };
};

const normalizeMeals = (value: unknown): NutritionRecommendationMeals | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const meals: NutritionRecommendationMeals = {
    breakfast: normalizeMealRecommendation(payload.breakfast),
    lunch: normalizeMealRecommendation(payload.lunch),
    dinner: normalizeMealRecommendation(payload.dinner),
    snack: normalizeMealRecommendation(payload.snack)
  } as NutritionRecommendationMeals;

  if (MEAL_ORDER.some((key) => !meals[key])) {
    return null;
  }

  return meals;
};

const normalizeNoteResponse = (value: unknown, input: RecommendNutritionInput): NutritionNoteResponse | null => {
  if (!input.note.trim()) {
    return null;
  }

  const noteSignals = deriveNoteSignals(input.note);
  const fallbackTitle =
    noteSignals.type === 'question'
      ? '你这次的问题，我先这样理解'
      : noteSignals.type === 'constraint'
        ? '你这次的补充要求，我已经纳入安排'
        : noteSignals.type === 'mixed'
          ? '你的问题和限制，我一起考虑了'
          : '这次补充要求，我已经一起带入推荐';

  if (typeof value !== 'object' || value === null) {
    return {
      input: input.note.trim(),
      type: noteSignals.type,
      title: fallbackTitle,
      summary:
        noteSignals.type === 'question'
          ? '我会先回答你最关心的问题，再把这个理解体现在三餐安排里。'
          : '我会把你的补充要求优先落实到餐次结构、食物选择和可替代项里。',
      bullets: Array.from(new Set([...noteSignals.questionKeywords, ...noteSignals.lifestyleKeywords, ...noteSignals.restrictionTokens])).slice(0, 3)
    };
  }

  const payload = value as Record<string, unknown>;
  const bullets = normalizeStringArray(payload.bullets, 4);

  return {
    input: input.note.trim(),
    type: noteSignals.type,
    title: toShortText(payload.title, fallbackTitle),
    summary: toShortText(payload.summary, '我已经把这次补充要求一起带入推荐结果。'),
    bullets
  };
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

const buildMealRecommendation = (payload: {
  title: string;
  suggestedFoods: string[];
  suggestedPortions: string[];
  why: string;
  alternatives?: string[];
  detail?: string;
}): NutritionMealRecommendation => ({
  title: payload.title,
  suggestedFoods: payload.suggestedFoods.filter(Boolean).slice(0, 5),
  suggestedPortions: payload.suggestedPortions.filter(Boolean).slice(0, 4),
  why: payload.why,
  alternatives: (payload.alternatives ?? []).filter(Boolean).slice(0, 4),
  detail: payload.detail?.trim() || payload.why
});

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
    breakfast: buildMealRecommendation({
      title: '稳定开启一天，先把蛋白质和基础能量补上',
      suggestedFoods: [oats?.name, egg?.name, milk?.name, fruit?.name].filter((item): item is string => Boolean(item)),
      suggestedPortions: ['燕麦 40-60g', '鸡蛋 1-2 个', '牛奶 250ml'],
      why: breakfastGuide || '早餐先把蛋白质和复合碳水补齐，更容易稳定上午精力和饱腹感。',
      alternatives: ['无糖酸奶', '全麦面包', '豆腐'],
      detail: '如果早上时间紧，优先保留蛋白质来源，再配一个主食或水果。'
    }),
    lunch: buildMealRecommendation({
      title: '午餐保持主食、蛋白质和蔬菜三件套',
      suggestedFoods: [rice?.name, chicken?.name, vegetable?.name].filter((item): item is string => Boolean(item)),
      suggestedPortions: [`主食 ${lunchCarbPortion}1 拳`, '蛋白质 1 掌心', '蔬菜 2 拳'],
      why: lunchGuide || '午餐是最稳的一餐，结构清晰比菜单花哨更重要。',
      alternatives: ['虾仁', '豆腐', '红薯'],
      detail: '如果在外就餐，也尽量按主食、瘦肉、蔬菜的顺序点单。'
    }),
    dinner: buildMealRecommendation({
      title: '晚餐继续清晰搭配，但不过度堆热量',
      suggestedFoods: [salmon?.name, vegetable?.name, rice?.name].filter((item): item is string => Boolean(item)),
      suggestedPortions: [`主食 ${dinnerCarbPortion}1 拳`, '蛋白质 1 掌心', '蔬菜 1-2 拳'],
      why: dinnerGuide || '晚餐更强调好消化和执行稳定，避免高油高糖带来额外负担。',
      alternatives: ['鸡蛋', '鸡胸肉', '菠菜'],
      detail: '晚餐可以比午餐更清淡，但不建议把蛋白质直接省掉。'
    }),
    snack: buildMealRecommendation({
      title: '加餐尽量简单，负责补足而不是额外放纵',
      suggestedFoods: [fruit?.name, milk?.name, egg?.name].filter((item): item is string => Boolean(item)),
      suggestedPortions: ['水果 1 份', '牛奶 250ml 或鸡蛋 1 个'],
      why: snackGuide || '加餐的核心是把两餐之间的空档稳住，别让你饿到失控。',
      alternatives: ['无糖酸奶', '香蕉', '蓝莓'],
      detail: '训练前后或下午容易饿的时候，加餐可以优先选水果配蛋白质来源。'
    })
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

const buildFallbackNoteResponse = (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[]
): NutritionNoteResponse | null => {
  const note = input.note.trim();
  if (!note) {
    return null;
  }

  const noteSignals = deriveNoteSignals(note);
  const topGuideline = guidelines[0];
  const keywordBullets = Array.from(
    new Set([...noteSignals.questionKeywords, ...noteSignals.lifestyleKeywords, ...noteSignals.restrictionTokens])
  ).slice(0, 3);

  if (noteSignals.type === 'question' || noteSignals.type === 'mixed') {
    return {
      input: note,
      type: noteSignals.type,
      title: '你这次提到的问题，我先直接回答',
      summary:
        topGuideline?.content ||
        '我会先说明问题背后的差异，再把这个理解落实到三餐安排、份量和可替代食物里。',
      bullets: keywordBullets.length > 0 ? keywordBullets : ['目标差异', '餐次结构', '执行方式']
    };
  }

  return {
    input: note,
    type: noteSignals.type,
    title: '你这次的补充要求，我已经一起带入推荐',
    summary:
      topGuideline?.content || '我会优先根据你的时间、限制或饮食偏好，调整食物选择、份量和可替代项。',
    bullets: keywordBullets.length > 0 ? keywordBullets : ['限制过滤', '执行难度', '可替代食物']
  };
};

const buildFallbackNutritionResult = (
  input: RecommendNutritionInput,
  guidelines: RetrievedGuideline[],
  foods: NutritionFoodCard[]
): NutritionRecommendationResult => ({
  summary: buildFallbackSummary(input.goal, guidelines),
  noteResponse: buildFallbackNoteResponse(input, guidelines),
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
    'JSON 字段必须包含：summary, noteResponse, meals, tips, referencedFoodNames。',
    '如果用户填写了补充要求或问题，noteResponse 必须包含 title、summary、bullets；若用户未填写，可返回 null。',
    'meals 必须包含 breakfast, lunch, dinner, snack 四个字段。',
    '每个 meal 必须包含：title, suggestedFoods, suggestedPortions, why, alternatives, detail。',
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
    noteResponse: normalizeNoteResponse(parsed.noteResponse, input),
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
