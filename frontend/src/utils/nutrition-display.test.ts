import { describe, expect, it } from 'vitest';
import { buildNutritionMealViewModels, buildNutritionSummaryViewModel } from './nutrition-display';

const result = {
  summary: '基于减脂目标，本建议优先控制总热量并保证蛋白质摄入，每餐安排优质蛋白和高纤维食物提升饱腹感，避免高糖饮料、油炸食品和频繁加餐。',
  meals: {
    breakfast: '早餐可食用2个水煮鸡蛋搭配50克燕麦片和200毫升无糖牛奶，提供优质蛋白和复合碳水，帮助稳定上午能量。',
    lunch: '午餐建议食用约100克鸡胸肉，搭配一拳大小的熟米饭和200克焯水西兰花，保证蛋白质摄入并控制主食份量。',
    dinner: '晚餐可选择三文鱼和蔬菜，再配半拳米饭，整体保持清淡。',
    snack: '加餐可安排一根香蕉搭配一杯无糖牛奶，补充能量和微量营养素。'
  },
  tips: ['少油烹饪', '避免含糖饮料'],
  referencedFoods: [
    { id: 'egg', name: '鸡蛋', aliases: ['全蛋'], category: 'protein', unit: '100g', nutritionPer100g: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0 }, highlights: [], benefits: [], keywords: [] },
    { id: 'oats', name: '燕麦', aliases: ['燕麦片'], category: 'staple', unit: '100g', nutritionPer100g: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0 }, highlights: [], benefits: [], keywords: [] },
    { id: 'milk', name: '牛奶', aliases: ['无糖牛奶'], category: 'dairy', unit: '100g', nutritionPer100g: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0 }, highlights: [], benefits: [], keywords: [] },
    { id: 'chicken', name: '鸡胸肉', aliases: ['鸡胸'], category: 'protein', unit: '100g', nutritionPer100g: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0 }, highlights: [], benefits: [], keywords: [] }
  ],
  knowledgeMeta: {
    guidelineCount: 6,
    foodCount: 4,
    source: 'llm'
  }
} as const;

describe('nutrition-display', () => {
  it('builds summary highlights from summary and tips', () => {
    const summary = buildNutritionSummaryViewModel(result);

    expect(summary.highlights[0]).toContain('少油烹饪');
    expect(summary.highlights).toContain('基于减脂目标');
    expect(summary.highlights).toContain('少油烹饪');
  });

  it('builds meal cards with portions and foods', () => {
    const meals = buildNutritionMealViewModels(result.meals, result.referencedFoods as never);

    expect(meals[0]?.title).toContain('2个水煮鸡蛋');
    expect(meals[0]?.portions).toEqual(['2个', '50克', '200毫升']);
    expect(meals[0]?.foods).toEqual(['鸡蛋', '燕麦', '牛奶']);
    expect(meals[1]?.foods).toContain('鸡胸肉');
  });
});
