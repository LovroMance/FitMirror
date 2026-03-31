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
const MIN_EXERCISE_ITEMS = 5;
const MAX_EXERCISE_ITEMS = 7;
const SUMMARY_MAX_CHARS = 360;
const TITLE_MAX_CHARS = 100;

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
  const exerciseCount = durationMinutes >= 20 ? 6 : 5;
  const durationSeconds = Math.floor((durationMinutes * 60) / exerciseCount);

  if (goalType === 'core') {
    return [
      {
        name: '动态热身-猫牛式与躯干激活',
        durationSeconds: Math.max(35, Math.min(durationSeconds, 90)),
        restSeconds: 15,
        instruction: '以呼吸带动脊柱活动，完成猫牛式和躯干旋转。动作过程中保持骨盆稳定，为核心训练建立发力感。'
      },
      {
        name: '平板支撑',
        durationSeconds: Math.max(35, Math.min(durationSeconds, 80)),
        restSeconds: 20,
        instruction: '前臂推地、肩胛外展，收紧腹部和臀部。全程保持身体成一直线，出现塌腰时缩短时长但保持标准动作。'
      },
      {
        name: '死虫式',
        reps: '左右各 10-12 次',
        restSeconds: 25,
        instruction: '下背部贴地，肋骨微收，手脚对侧缓慢伸展。每次回收时主动收紧腹部，避免利用惯性摆动。'
      },
      {
        name: noEquipment ? '仰卧交替抬腿' : '悬垂举腿',
        reps: '12-16 次',
        restSeconds: 25,
        instruction: '上抬时呼气并主动卷腹，下放时控制 2-3 秒。注意下背不要离地或大幅反弓，保持核心持续紧张。'
      },
      {
        name: '侧桥支撑',
        durationSeconds: 40,
        restSeconds: 20,
        instruction: '左右两侧交替进行，肩-髋-踝保持同轴。髋部不要下沉，顶部腿可微抬提升臀中肌参与。'
      },
      {
        name: '放松-仰卧抱膝与腹式呼吸',
        durationSeconds: 50,
        restSeconds: 15,
        instruction: '以慢呼吸降低心率，拉伸腰背与髋屈肌。最后进行 6-8 次深呼吸，帮助核心区放松恢复。'
      }
    ];
  }

  if (goalType === 'fat-loss') {
    return [
      {
        name: '动态热身-原地快走与开肩',
        durationSeconds: Math.max(35, Math.min(durationSeconds, 90)),
        restSeconds: 15,
        instruction: '先提升心率，再活动肩髋关节。热身阶段保持轻快节奏，为后续间歇训练做准备。'
      },
      {
        name: '开合跳',
        durationSeconds: Math.max(40, Math.min(durationSeconds, 95)),
        restSeconds: 20,
        instruction: '落地脚掌先接触地面，膝盖微屈减震。通过稳定频率维持中高心率，不要忽快忽慢。'
      },
      {
        name: '深蹲',
        reps: '15-18 次',
        restSeconds: 25,
        instruction: '臀部向后坐，胸腔打开，膝盖跟随脚尖方向。起身阶段主动收紧臀腿，避免借腰发力。'
      },
      {
        name: '高抬腿',
        durationSeconds: 45,
        restSeconds: 25,
        instruction: '膝盖抬至接近髋部高度，核心收紧防止躯干后仰。落地后立刻切换另一侧，保证节奏连续。'
      },
      {
        name: '登山跑',
        durationSeconds: 40,
        restSeconds: 20,
        instruction: '肩膀垂直于手腕，腹部发力带动腿部交替。避免臀部过高或塌腰，尽量保持平板姿势。'
      },
      {
        name: '放松-股四头肌与小腿拉伸',
        durationSeconds: 55,
        restSeconds: 15,
        instruction: '逐步放慢呼吸，拉伸大腿前侧与小腿后侧。每个部位保持 15-20 秒，帮助训练后恢复。'
      }
    ];
  }

  return [
    {
      name: '动态热身-肩髋联动',
      durationSeconds: Math.max(35, Math.min(durationSeconds, 85)),
      restSeconds: 15,
      instruction: '进行肩部环绕、髋关节外展与轻度深蹲热身。让上肢与下肢进入稳定发力状态。'
    },
    {
      name: '徒手深蹲',
      reps: '15-18 次',
      restSeconds: 25,
      instruction: '脚掌全程踩稳，重心在中后足。下蹲时控制离心速度，起身时主动收紧臀部与核心。'
    },
    {
      name: noEquipment ? '跪姿俯卧撑' : '俯卧撑',
      reps: '10-14 次',
      restSeconds: 30,
      instruction: '下降时吸气并保持肘部约 45 度，推起时呼气。全程保持躯干稳定，避免腰部下塌。'
    },
    {
      name: '反向弓步',
      reps: '左右各 12 次',
      restSeconds: 25,
      instruction: '后撤腿轻触地面后迅速前推回位，重心保持在前腿。躯干直立，避免前倾借力。'
    },
    {
      name: '平板支撑',
      durationSeconds: 45,
      restSeconds: 20,
      instruction: '肩、髋、踝保持同一直线，不要耸肩。通过腹压控制身体稳定，出现抖动可缩短时长。'
    },
    {
      name: '放松-胸背与髋屈肌拉伸',
      durationSeconds: 55,
      restSeconds: 15,
      instruction: '训练后拉伸胸背和髋前侧，恢复关节活动度。配合均匀呼吸，降低肌肉紧张感。'
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
  const instructionRaw = typeof candidate.instruction === 'string' ? candidate.instruction.trim() : '';

  if (!name || !instructionRaw) {
    return null;
  }
  const instruction =
    instructionRaw.length >= 20
      ? instructionRaw
      : `${instructionRaw} 动作过程中保持呼吸稳定，优先保证动作标准和节奏控制。`;

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
    .slice(0, MAX_EXERCISE_ITEMS);

  if (exercises.length < MIN_EXERCISE_ITEMS) {
    return null;
  }

  const durationRaw = toFiniteNumber(candidate.durationMinutes);
  const durationMinutes = Math.min(
    Math.max(Math.round(durationRaw ?? parseDuration(goalText)), MIN_DURATION_MINUTES),
    MAX_DURATION_MINUTES
  );

  const title =
    typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim().slice(0, TITLE_MAX_CHARS)
      : `${durationMinutes}分钟个性化训练计划`;

  const summaryRaw =
    typeof candidate.summary === 'string' && candidate.summary.trim()
      ? candidate.summary.trim().slice(0, SUMMARY_MAX_CHARS)
      : '根据你的目标生成了可执行的训练安排。';
  const summary =
    summaryRaw.length >= 70
      ? summaryRaw
      : `${summaryRaw} 训练前先做热身，训练中保持呼吸节奏，训练后进行拉伸放松，以提升执行质量与恢复效率。`;

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
    '请根据用户目标生成详细且可执行的健身训练计划。',
    '只返回 JSON，不要返回 markdown，不要额外解释。',
    'JSON 字段必须包含：title, level, durationMinutes, summary, exercises。',
    '其中 level 只能是 beginner 或 intermediate。',
    'summary 用中文，建议 120-220 字，包含训练重点、节奏建议、动作标准和恢复提示。',
    'exercises 必须是 5 到 7 项数组，顺序建议包含热身、主训练和放松。',
    '每项字段必须包含：name, instruction, restSeconds，以及 durationSeconds 或 reps 二选一。',
    'instruction 用中文完整句子，建议 40 字以上，描述发力要点、动作标准和常见错误规避。',
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
    ? '本计划以徒手动作为主，采用“热身-主训练-放松”结构，适合居家场景快速执行。训练中请优先保证动作质量与呼吸节奏，出现明显代偿时可适当降低次数或缩短时长。'
    : '本计划结合基础器械与自重动作，采用分段推进的节奏安排，兼顾强度与恢复。建议训练前后保留充足热身与放松时间，确保动作稳定并降低受伤风险。';

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
