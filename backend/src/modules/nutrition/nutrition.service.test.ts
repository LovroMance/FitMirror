import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosPostMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    post: axiosPostMock,
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError)
  }
}));

import { env } from '../../config/env';
import { recommendNutrition } from './nutrition.service';

describe('nutrition.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.deepseekApiKey = 'test-key';
  });

  afterEach(() => {
    env.deepseekApiKey = '';
  });

  it('returns recommendation result for fat loss input', async () => {
    axiosPostMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: '减脂阶段建议优先保证蛋白质和蔬菜摄入，并控制精制零食和高油烹饪。',
                noteResponse: null,
                meals: {
                  breakfast: {
                    title: '早餐先稳住能量和蛋白质',
                    suggestedFoods: ['燕麦', '鸡蛋', '牛奶'],
                    suggestedPortions: ['燕麦 50g', '鸡蛋 2 个'],
                    why: '帮助提升饱腹感并补充蛋白质。',
                    alternatives: ['无糖酸奶'],
                    detail: '优先用高蛋白加复合碳水开启一天。'
                  },
                  lunch: {
                    title: '午餐保留主食和蛋白质',
                    suggestedFoods: ['熟米饭', '鸡胸肉', '西兰花'],
                    suggestedPortions: ['主食 1 拳', '蛋白质 1 掌心'],
                    why: '兼顾恢复与控制总能量。',
                    alternatives: ['虾仁'],
                    detail: '午餐结构清晰，下午更稳。'
                  },
                  dinner: {
                    title: '晚餐更清淡但别省蛋白质',
                    suggestedFoods: ['三文鱼', '西兰花'],
                    suggestedPortions: ['蛋白质 1 掌心', '蔬菜 2 拳'],
                    why: '避免高油高糖和过量主食。',
                    alternatives: ['鸡蛋'],
                    detail: '晚餐适当减少主食份量。'
                  },
                  snack: {
                    title: '加餐负责稳住空档',
                    suggestedFoods: ['蓝莓', '牛奶'],
                    suggestedPortions: ['水果 1 份', '牛奶 250ml'],
                    why: '控制分量并补充微量营养素。',
                    alternatives: ['苹果'],
                    detail: '用水果加蛋白质来源替代零食。'
                  }
                },
                tips: ['每餐优先安排蛋白质来源', '尽量用蒸煮烤替代油炸', '训练日注意补水'],
                referencedFoodNames: ['鸡胸肉', '蓝莓', '熟米饭']
              })
            }
          }
        ]
      }
    });

    const result = await recommendNutrition({
      goal: 'fat_loss',
      preferences: ['high_protein', 'light'],
      note: ''
    });

    expect(result.summary).toContain('蛋白质');
    expect(result.meals.breakfast.suggestedFoods).toContain('燕麦');
    expect(result.referencedFoods.map((item) => item.name)).toEqual(['鸡胸肉', '蓝莓', '熟米饭']);
    expect(result.knowledgeMeta.guidelineCount).toBeGreaterThan(0);
    expect(result.knowledgeMeta.foodCount).toBeGreaterThan(0);
    expect(result.knowledgeMeta.source).toBe('llm');
  });

  it('lets preferences affect retrieval and food alias resolution', async () => {
    axiosPostMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: '增肌阶段应保证规律三餐和高蛋白加餐。',
                noteResponse: {
                  title: '你这次的问题，我先这样理解',
                  summary: '减脂更强调总热量控制和饱腹感，增肌更强调稳定热量盈余和训练前后补给。',
                  bullets: ['减脂增肌区别', '主食份量', '训练前后加餐']
                },
                meals: {
                  breakfast: {
                    title: '早餐补足碳水和蛋白质',
                    suggestedFoods: ['燕麦', '鸡蛋', '牛奶'],
                    suggestedPortions: ['燕麦 60g'],
                    why: '帮助补足夜间空腹后的能量和蛋白质。',
                    alternatives: ['无糖酸奶'],
                    detail: '早餐更强调稳定补能。'
                  },
                  lunch: {
                    title: '午餐把主食和瘦肉都吃够',
                    suggestedFoods: ['熟米饭', '鸡胸肉', '西兰花'],
                    suggestedPortions: ['主食 1-1.5 拳'],
                    why: '增肌期午餐是补足全天能量的重要一餐。',
                    alternatives: ['虾仁'],
                    detail: '午餐别只吃菜。'
                  },
                  dinner: {
                    title: '晚餐继续补足恢复所需',
                    suggestedFoods: ['三文鱼', '熟米饭'],
                    suggestedPortions: ['蛋白质 1 掌心'],
                    why: '训练后恢复也需要主食和蛋白质。',
                    alternatives: ['鸡蛋'],
                    detail: '不要只靠高油高糖堆热量。'
                  },
                  snack: {
                    title: '加餐负责补齐总摄入',
                    suggestedFoods: ['香蕉', '牛奶'],
                    suggestedPortions: ['水果 1 份'],
                    why: '两餐之间补足更容易完成增肌期摄入。',
                    alternatives: ['无糖酸奶'],
                    detail: '加餐尽量简单。'
                  }
                },
                tips: ['训练后注意补充蛋白质', '不要只靠高油高糖堆热量'],
                referencedFoodNames: ['鸡胸', '香蕉']
              })
            }
          }
        ]
      }
    });

    const result = await recommendNutrition({
      goal: 'muscle_gain',
      preferences: ['high_protein', 'quick'],
      note: '减脂和增肌有什么不同'
    });

    expect(result.referencedFoods.map((item) => item.name)).toEqual(['鸡胸肉', '香蕉']);
    expect(result.noteResponse?.summary).toContain('减脂');
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    expect(String(axiosPostMock.mock.calls[0]?.[1]?.messages?.[1]?.content ?? '')).toContain('减脂和增肌有什么不同');
  });

  it('retries once and falls back to stable recommendation when llm output stays invalid', async () => {
    axiosPostMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'test',
                noteResponse: {
                  title: 'test',
                  summary: 'test',
                  bullets: ['工作日省时']
                },
                meals: {
                  breakfast: {
                    title: '早餐',
                    suggestedFoods: [],
                    suggestedPortions: [],
                    why: 'test',
                    alternatives: [],
                    detail: 'test'
                  }
                },
                tips: ['提示1', '提示2'],
                referencedFoodNames: ['鸡胸肉']
              })
            }
          }
        ]
      }
    });

    const result = await recommendNutrition({
      goal: 'fat_loss',
      preferences: ['high_protein'],
      note: '工作日做饭时间少'
    });

    expect(axiosPostMock).toHaveBeenCalledTimes(2);
    expect(result.knowledgeMeta.source).toBe('fallback');
    expect(result.summary).toContain('减脂阶段');
    expect(result.meals.breakfast.title).toContain('稳定');
    expect(result.noteResponse?.title).toContain('补充');
    expect(result.noteResponse?.summary).toContain('工作日做饭时间少');
    expect(result.tips.length).toBeGreaterThanOrEqual(2);
  });

  it('returns llm result after retry recovers from a transient timeout', async () => {
    axiosPostMock
      .mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNABORTED', response: undefined })
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '增肌阶段要保证规律进餐和蛋白质摄入。',
                  noteResponse: null,
                  meals: {
                    breakfast: {
                      title: '早餐补足夜间后的能量缺口',
                      suggestedFoods: ['燕麦', '鸡蛋', '牛奶'],
                      suggestedPortions: ['燕麦 60g'],
                      why: '先补碳水和蛋白质。',
                      alternatives: ['无糖酸奶'],
                      detail: '早餐别太空。'
                    },
                    lunch: {
                      title: '午餐继续吃够主食和蛋白质',
                      suggestedFoods: ['熟米饭', '鸡胸肉', '西兰花'],
                      suggestedPortions: ['主食 1 拳'],
                      why: '帮助恢复与合成。',
                      alternatives: ['虾仁'],
                      detail: '结构清晰。'
                    },
                    dinner: {
                      title: '晚餐延续恢复节奏',
                      suggestedFoods: ['三文鱼', '熟米饭'],
                      suggestedPortions: ['蛋白质 1 掌心'],
                      why: '避免摄入不足。',
                      alternatives: ['鸡蛋'],
                      detail: '不过度油腻。'
                    },
                    snack: {
                      title: '加餐补足两餐空档',
                      suggestedFoods: ['香蕉', '牛奶'],
                      suggestedPortions: ['水果 1 份'],
                      why: '训练前后更方便执行。',
                      alternatives: ['苹果'],
                      detail: '简单高效。'
                    }
                  },
                  tips: ['训练后补充蛋白质', '主食不要过度不足'],
                  referencedFoodNames: ['鸡胸肉', '香蕉']
                })
              }
            }
          ]
        }
      });

    const result = await recommendNutrition({
      goal: 'muscle_gain',
      preferences: ['high_protein'],
      note: ''
    });

    expect(axiosPostMock).toHaveBeenCalledTimes(2);
    expect(result.knowledgeMeta.source).toBe('llm');
    expect(result.summary).toContain('增肌');
  });
});
