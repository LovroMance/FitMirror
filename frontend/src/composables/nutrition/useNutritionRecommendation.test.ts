import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recommendNutritionApiMock, messageSuccess, messageError } = vi.hoisted(() => ({
  recommendNutritionApiMock: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn()
}));

vi.mock('@/api/nutrition', () => ({
  recommendNutritionApi: recommendNutritionApiMock
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    success: messageSuccess,
    error: messageError
  }
}));

import { useNutritionRecommendation } from './useNutritionRecommendation';

describe('useNutritionRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits recommendation and stores result', async () => {
    recommendNutritionApiMock.mockResolvedValue({
      summary: '建议每餐优先安排蛋白质和蔬菜。',
      meals: {
        breakfast: '早餐可安排燕麦、鸡蛋和牛奶。',
        lunch: '午餐可安排米饭、鸡胸肉和西兰花。',
        dinner: '晚餐可安排三文鱼和蔬菜。',
        snack: '加餐可安排蓝莓和牛奶。'
      },
      tips: ['控制零食频率', '少油烹饪'],
      referencedFoods: [],
      knowledgeMeta: {
        guidelineCount: 6,
        foodCount: 4
      }
    });

    const nutrition = useNutritionRecommendation();
    nutrition.preferences.value = ['high_protein', 'quick'];
    nutrition.note.value = '不吃辣';

    await nutrition.submitRecommendation();

    expect(recommendNutritionApiMock).toHaveBeenCalledWith({
      goal: 'fat_loss',
      preferences: ['high_protein', 'quick'],
      note: '不吃辣'
    });
    expect(nutrition.pageState.value).toBe('ready');
    expect(nutrition.result.value?.meals.breakfast).toContain('燕麦');
    expect(messageSuccess).toHaveBeenCalledWith('饮食建议已生成');
  });

  it('shows error state when request fails without last result', async () => {
    recommendNutritionApiMock.mockRejectedValue(new Error('服务异常'));

    const nutrition = useNutritionRecommendation();
    await nutrition.submitRecommendation();

    expect(nutrition.pageState.value).toBe('error');
    expect(nutrition.errorMessage.value).toBe('服务异常');
    expect(messageError).toHaveBeenCalledWith('服务异常');
  });

  it('keeps ready state when refresh fails after existing result', async () => {
    recommendNutritionApiMock
      .mockResolvedValueOnce({
        summary: '建议',
        meals: {
          breakfast: '早餐',
          lunch: '午餐',
          dinner: '晚餐',
          snack: '加餐'
        },
        tips: ['提示1', '提示2'],
        referencedFoods: [],
        knowledgeMeta: {
          guidelineCount: 6,
          foodCount: 4
        }
      })
      .mockRejectedValueOnce(new Error('二次生成失败'));

    const nutrition = useNutritionRecommendation();
    await nutrition.submitRecommendation();
    await nutrition.submitRecommendation();

    expect(nutrition.pageState.value).toBe('ready');
    expect(nutrition.errorMessage.value).toBe('二次生成失败');
  });
});
