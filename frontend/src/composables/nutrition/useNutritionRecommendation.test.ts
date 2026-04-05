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
      noteResponse: {
        input: '不吃辣',
        type: 'constraint',
        title: '你这次的补充要求，我已经一起带入推荐',
        summary: '这次我会避开辣味刺激，优先保留清晰结构和可执行性。',
        bullets: ['不吃辣', '清淡口味']
      },
      meals: {
        breakfast: {
          title: '早餐先稳住能量',
          suggestedFoods: ['燕麦', '鸡蛋', '牛奶'],
          suggestedPortions: ['燕麦 50g'],
          why: '帮助提升饱腹感。',
          alternatives: ['无糖酸奶'],
          detail: '优先高蛋白加复合碳水。'
        },
        lunch: {
          title: '午餐结构保持清晰',
          suggestedFoods: ['熟米饭', '鸡胸肉', '西兰花'],
          suggestedPortions: ['主食 1 拳'],
          why: '兼顾恢复与控制总能量。',
          alternatives: ['虾仁'],
          detail: '尽量避开重油重辣。'
        },
        dinner: {
          title: '晚餐继续保留蛋白质',
          suggestedFoods: ['三文鱼', '蔬菜'],
          suggestedPortions: ['蛋白质 1 掌心'],
          why: '避免晚间额外负担。',
          alternatives: ['鸡蛋'],
          detail: '整体更清淡。'
        },
        snack: {
          title: '加餐简化执行',
          suggestedFoods: ['蓝莓', '牛奶'],
          suggestedPortions: ['水果 1 份'],
          why: '减少零食波动。',
          alternatives: ['苹果'],
          detail: '两餐之间更稳。'
        }
      },
      tips: ['控制零食频率', '少油烹饪'],
      referencedFoods: [],
      knowledgeMeta: {
        guidelineCount: 6,
        foodCount: 4,
        source: 'llm'
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
    expect(nutrition.result.value?.meals.breakfast.suggestedFoods).toContain('燕麦');
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
        noteResponse: null,
        meals: {
          breakfast: { title: '早餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' },
          lunch: { title: '午餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' },
          dinner: { title: '晚餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' },
          snack: { title: '加餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' }
        },
        tips: ['提示1', '提示2'],
        referencedFoods: [],
        knowledgeMeta: {
          guidelineCount: 6,
          foodCount: 4,
          source: 'llm'
        }
      })
      .mockRejectedValueOnce(new Error('二次生成失败'));

    const nutrition = useNutritionRecommendation();
    await nutrition.submitRecommendation();
    await nutrition.submitRecommendation();

    expect(nutrition.pageState.value).toBe('ready');
    expect(nutrition.errorMessage.value).toBe('二次生成失败');
  });

  it('marks fallback result and shows stable recommendation toast', async () => {
    recommendNutritionApiMock.mockResolvedValue({
      summary: '建议优先保证三餐规律。',
      noteResponse: null,
      meals: {
        breakfast: { title: '早餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' },
        lunch: { title: '午餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' },
        dinner: { title: '晚餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' },
        snack: { title: '加餐', suggestedFoods: [], suggestedPortions: [], why: 'why', alternatives: [], detail: 'detail' }
      },
      tips: ['提示1', '提示2'],
      referencedFoods: [],
      knowledgeMeta: {
        guidelineCount: 5,
        foodCount: 4,
        source: 'fallback'
      }
    });

    const nutrition = useNutritionRecommendation();
    await nutrition.submitRecommendation();

    expect(nutrition.isFallbackResult.value).toBe(true);
    expect(messageSuccess).toHaveBeenCalledWith('已生成稳定饮食建议');
  });
});
