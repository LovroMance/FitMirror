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
                meals: {
                  breakfast: '早餐可安排燕麦、鸡蛋和牛奶，帮助提升饱腹感并补充蛋白质。',
                  lunch: '午餐可安排少量米饭、鸡胸肉和西兰花，兼顾恢复与控制总能量。',
                  dinner: '晚餐建议选择三文鱼搭配蔬菜，并适当减少主食份量。',
                  snack: '加餐可选择蓝莓搭配牛奶，控制分量并补充微量营养素。'
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
    expect(result.meals.breakfast).toContain('燕麦');
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
                meals: {
                  breakfast: '早餐可安排燕麦、鸡蛋和牛奶。',
                  lunch: '午餐可安排米饭、鸡胸和西兰花。',
                  dinner: '晚餐可安排三文鱼和米饭。',
                  snack: '加餐可安排香蕉和牛奶。'
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
                meals: {
                  breakfast: '早餐'
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
    expect(result.meals.breakfast).toContain('可安排');
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
                  meals: {
                    breakfast: '早餐可安排燕麦、鸡蛋和牛奶。',
                    lunch: '午餐可安排米饭、鸡胸肉和西兰花。',
                    dinner: '晚餐可安排三文鱼和米饭。',
                    snack: '加餐可安排香蕉和牛奶。'
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
