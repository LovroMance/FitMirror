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

const detectNoEquipment = (goalText: string): boolean => {
  return /(无器械|没器械|居家|徒手|自重)/.test(goalText);
};

const detectGoalType = (goalText: string): 'core' | 'fat-loss' | 'full-body' => {
  if (/(腹|腰|核心|马甲线|瘦肚子)/.test(goalText)) {
    return 'core';
  }

  if (/(减脂|燃脂|瘦身)/.test(goalText)) {
    return 'fat-loss';
  }

  return 'full-body';
};

const detectLevel = (goalText: string): 'beginner' | 'intermediate' => {
  return /(新手|小白|入门|刚开始)/.test(goalText) ? 'beginner' : 'intermediate';
};

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

export type { GeneratedPlan, PlanExercise };
