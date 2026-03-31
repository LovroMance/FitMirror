import axios from 'axios';
import { env } from '../../config/env';

interface PlanExercise {
  name: string;
  durationSeconds?: number;
  reps?: string;
  restSeconds: number;
  instruction: string;
}

interface GeneratedPlan {
  title: string;
  level: 'beginner' | 'intermediate';
  durationMinutes: number;
  summary: string;
  exercises: PlanExercise[];
}

type PlanSource = 'deepseek' | 'template';

type LlmFailureReason =
  | 'missing_api_key'
  | 'timeout'
  | 'auth'
  | 'network'
  | 'provider_server'
  | 'provider_client'
  | 'invalid_response'
  | 'unknown';

type PlanProgressEventType =
  | 'queued'
  | 'llm_start'
  | 'llm_done'
  | 'llm_failed'
  | 'fallback_start'
  | 'completed';

interface PlanProgressEvent {
  type: PlanProgressEventType;
  source?: PlanSource;
  reason?: LlmFailureReason;
  plan?: GeneratedPlan;
}

interface GeneratePlanResult {
  plan: GeneratedPlan;
  source: PlanSource;
}

interface DeepSeekPlanResult {
  plan: GeneratedPlan | null;
  failureReason?: LlmFailureReason;
}

const DEFAULT_DURATION_MINUTES = 12;
const MIN_DURATION_MINUTES = 6;
const MAX_DURATION_MINUTES = 45;

const parseDuration = (goalText: string): number => {
  const matched = goalText.match(/(\d{1,2})\s*分钟/);
  if (!matched) {
    return DEFAULT_DURATION_MINUTES;
  }

  const value = Number(matched[1]);
  if (Number.isNaN(value)) {
    return DEFAULT_DURATION_MINUTES;
  }

  return Math.min(Math.max(value, MIN_DURATION_MINUTES), MAX_DURATION_MINUTES);
};

const detectNoEquipment = (goalText: string): boolean => /(无器械|没器械|居家|徒手|自重)/.test(goalText);

const detectGoalType = (goalText: string): 'core' | 'fat-loss' | 'full-body' => {
  if (/(腹|腰|核心|马甲线|瘦肚子)/.test(goalText)) {
    return 'core';
  }

  if (/(减脂|燃脂|瘦身)/.test(goalText)) {
    return 'fat-loss';
  }

  return 'full-body';
};

const detectLevel = (goalText: string): 'beginner' | 'intermediate' =>
  /(新手|小白|入门|刚开始)/.test(goalText) ? 'beginner' : 'intermediate';

const buildExercises = (
  goalType: 'core' | 'fat-loss' | 'full-body',
  durationMinutes: number,
  noEquipment: boolean
): PlanExercise[] => {
  const durationSeconds = Math.floor((durationMinutes * 60) / 4);

  if (goalType === 'core') {
    return [
      {
        name: '平板支撑',
        durationSeconds: Math.max(30, Math.min(durationSeconds, 75)),
        restSeconds: 20,
        instruction: '收紧核心，避免塌腰，保持颈部中立。'
      },
      {
        name: '卷腹',
        reps: '15-20 次',
        restSeconds: 25,
        instruction: '下背贴地，发力集中在腹部，不要借力甩头。'
      },
      {
        name: noEquipment ? '仰卧交替抬腿' : '悬垂举腿',
        reps: '12-16 次',
        restSeconds: 25,
        instruction: '动作放慢，控制下放过程，保持腹部紧张。'
      },
      {
        name: '侧桥支撑',
        durationSeconds: 35,
        restSeconds: 20,
        instruction: '左右各做一组，髋部保持稳定，不要前后晃动。'
      }
    ];
  }

  if (goalType === 'fat-loss') {
    return [
      {
        name: '开合跳',
        durationSeconds: Math.max(35, Math.min(durationSeconds, 90)),
        restSeconds: 20,
        instruction: '落地轻缓，膝盖微屈，节奏均匀。'
      },
      {
        name: '深蹲',
        reps: '15 次',
        restSeconds: 25,
        instruction: '臀部后坐，膝盖与脚尖方向一致。'
      },
      {
        name: '高抬腿',
        durationSeconds: 40,
        restSeconds: 25,
        instruction: '抬腿至髋部高度，核心收紧。'
      },
      {
        name: '登山跑',
        durationSeconds: 35,
        restSeconds: 20,
        instruction: '双手稳定支撑，保持身体一条线。'
      }
    ];
  }

  return [
    {
      name: '徒手深蹲',
      reps: '15 次',
      restSeconds: 25,
      instruction: '脚掌全程踩稳，膝盖不过度内扣。'
    },
    {
      name: noEquipment ? '跪姿俯卧撑' : '俯卧撑',
      reps: '10-12 次',
      restSeconds: 30,
      instruction: '下降吸气、推起呼气，保持核心稳定。'
    },
    {
      name: '反向弓步',
      reps: '左右各 12 次',
      restSeconds: 25,
      instruction: '躯干保持直立，前脚发力回到起始位。'
    },
    {
      name: '平板支撑',
      durationSeconds: 45,
      restSeconds: 20,
      instruction: '肩、髋、踝保持同一直线，不要耸肩。'
    }
  ];
};

const stripJsonCodeFence = (content: string): string =>
  content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

const safeParseJson = (content: string): unknown | null => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeLevel = (value: unknown, goalText: string): 'beginner' | 'intermediate' => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'beginner') {
      return 'beginner';
    }

    if (normalized === 'intermediate') {
      return 'intermediate';
    }

    if (normalized === 'advanced') {
      return 'intermediate';
    }
  }

  return detectLevel(goalText);
};

const normalizeExercise = (value: unknown): PlanExercise | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const instruction = typeof candidate.instruction === 'string' ? candidate.instruction.trim() : '';

  if (!name || !instruction) {
    return null;
  }

  const restSecondsRaw = toFiniteNumber(candidate.restSeconds);
  const restSeconds = Math.min(Math.max(Math.round(restSecondsRaw ?? 20), 10), 120);

  const durationRaw = toFiniteNumber(candidate.durationSeconds);
  const durationSeconds =
    durationRaw && durationRaw > 0 ? Math.min(Math.max(Math.round(durationRaw), 15), 300) : undefined;

  const reps = typeof candidate.reps === 'string' ? candidate.reps.trim() : '';

  if (!durationSeconds && !reps) {
    return {
      name,
      restSeconds,
      instruction,
      reps: '12-15 次'
    };
  }

  return {
    name,
    restSeconds,
    instruction,
    ...(durationSeconds ? { durationSeconds } : {}),
    ...(reps ? { reps } : {})
  };
};

const normalizePlan = (value: unknown, goalText: string): GeneratedPlan | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const exercisesRaw = Array.isArray(candidate.exercises) ? candidate.exercises : [];
  const exercises = exercisesRaw
    .map((item) => normalizeExercise(item))
    .filter((item): item is PlanExercise => item !== null)
    .slice(0, 5);

  if (exercises.length < 3) {
    return null;
  }

  const durationRaw = toFiniteNumber(candidate.durationMinutes);
  const durationMinutes = Math.min(
    Math.max(Math.round(durationRaw ?? parseDuration(goalText)), MIN_DURATION_MINUTES),
    MAX_DURATION_MINUTES
  );

  const title =
    typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim().slice(0, 80)
      : `${durationMinutes}分钟个性化训练计划`;

  const summary =
    typeof candidate.summary === 'string' && candidate.summary.trim()
      ? candidate.summary.trim().slice(0, 140)
      : '根据你的目标生成了可执行的训练安排。';

  return {
    title,
    level: normalizeLevel(candidate.level, goalText),
    durationMinutes,
    summary,
    exercises
  };
};

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

const buildDeepSeekPrompt = (goalText: string): string => {
  return [
    '请根据用户目标生成可执行的健身训练计划。',
    '只返回 JSON，不要返回 markdown，不要额外解释。',
    'JSON 字段必须包含：title, level, durationMinutes, summary, exercises。',
    '其中 level 只能是 beginner 或 intermediate。',
    'exercises 必须是 3 到 5 项数组，每项字段：name, instruction, restSeconds，以及 durationSeconds 或 reps 二选一。',
    `用户目标：${goalText}`
  ].join('\n');
};

const classifyLlmFailure = (error: unknown): LlmFailureReason => {
  if (!axios.isAxiosError(error)) {
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

const logPlanGeneration = (meta: {
  goalTextLength: number;
  source: PlanSource;
  durationMs: number;
  fallbackUsed: boolean;
  failureReason?: LlmFailureReason;
}): void => {
  const payload = {
    event: 'plan_generation',
    goalTextLength: meta.goalTextLength,
    source: meta.source,
    durationMs: meta.durationMs,
    fallbackUsed: meta.fallbackUsed,
    ...(meta.failureReason ? { failureReason: meta.failureReason } : {})
  };

  if (meta.failureReason) {
    console.warn('[FitMirror]', payload);
    return;
  }

  console.info('[FitMirror]', payload);
};

const generatePlanFromDeepSeek = async (goalText: string): Promise<DeepSeekPlanResult> => {
  if (!env.deepseekApiKey) {
    return {
      plan: null,
      failureReason: 'missing_api_key'
    };
  }

  try {
    const response = await axios.post<{
      choices?: Array<{ message?: { content?: unknown } }>;
    }>(
      `${env.deepseekBaseUrl}/chat/completions`,
      {
        model: env.deepseekModel,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              '你是健身教练助手。输出必须是合法 JSON，字段必须符合要求，不得包含额外解释。'
          },
          {
            role: 'user',
            content: buildDeepSeekPrompt(goalText)
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
    if (!text) {
      return {
        plan: null,
        failureReason: 'invalid_response'
      };
    }

    const parsed = safeParseJson(text);
    if (!parsed) {
      return {
        plan: null,
        failureReason: 'invalid_response'
      };
    }

    const normalized = normalizePlan(parsed, goalText);
    if (!normalized) {
      return {
        plan: null,
        failureReason: 'invalid_response'
      };
    }

    return {
      plan: normalized
    };
  } catch (error) {
    return {
      plan: null,
      failureReason: classifyLlmFailure(error)
    };
  }
};

export const generatePlanFromGoal = (goalText: string): GeneratedPlan => {
  const durationMinutes = parseDuration(goalText);
  const noEquipment = detectNoEquipment(goalText);
  const goalType = detectGoalType(goalText);
  const level = detectLevel(goalText);

  const titlePrefix =
    goalType === 'core' ? '核心激活' : goalType === 'fat-loss' ? '燃脂唤醒' : '全身激活';
  const title = `${durationMinutes}分钟${titlePrefix}训练`;

  const summary = noEquipment
    ? '本计划以徒手动作为主，适合居家快速完成。'
    : '本计划可结合基础器械，强度更均衡。';

  return {
    title,
    level,
    durationMinutes,
    summary,
    exercises: buildExercises(goalType, durationMinutes, noEquipment)
  };
};

export const generatePlanWithFallback = async (
  goalText: string,
  onProgress?: (event: PlanProgressEvent) => void
): Promise<GeneratePlanResult> => {
  const startAt = Date.now();

  onProgress?.({ type: 'queued' });
  onProgress?.({ type: 'llm_start' });

  const deepseekResult = await generatePlanFromDeepSeek(goalText);
  if (deepseekResult.plan) {
    onProgress?.({ type: 'llm_done', source: 'deepseek' });

    const result: GeneratePlanResult = {
      plan: deepseekResult.plan,
      source: 'deepseek'
    };

    onProgress?.({ type: 'completed', source: result.source, plan: result.plan });
    logPlanGeneration({
      goalTextLength: goalText.length,
      source: result.source,
      durationMs: Date.now() - startAt,
      fallbackUsed: false
    });

    return result;
  }

  onProgress?.({ type: 'llm_failed', reason: deepseekResult.failureReason ?? 'unknown' });
  onProgress?.({ type: 'fallback_start' });

  const fallbackPlan = generatePlanFromGoal(goalText);
  const result: GeneratePlanResult = {
    plan: fallbackPlan,
    source: 'template'
  };

  onProgress?.({ type: 'completed', source: result.source, plan: result.plan });
  logPlanGeneration({
    goalTextLength: goalText.length,
    source: result.source,
    durationMs: Date.now() - startAt,
    fallbackUsed: true,
    failureReason: deepseekResult.failureReason
  });

  return result;
};

export type {
  GeneratePlanResult,
  GeneratedPlan,
  LlmFailureReason,
  PlanExercise,
  PlanProgressEvent,
  PlanProgressEventType,
  PlanSource
};
