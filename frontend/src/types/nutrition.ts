export type NutritionGoal = 'fat_loss' | 'muscle_gain' | 'maintenance';

export type NutritionPreference = 'high_protein' | 'low_oil' | 'light' | 'quick';

export interface NutritionFoodCard {
  id: string;
  name: string;
  aliases: string[];
  category: 'staple' | 'protein' | 'dairy' | 'fruit' | 'vegetable';
  unit: string;
  nutritionPer100g: {
    energyKcal: number;
    proteinG: number;
    carbohydrateG: number;
    fatG: number;
    fiberG: number;
  };
  highlights: string[];
  benefits: string[];
  keywords: string[];
}

export interface NutritionRecommendationMeals {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

export interface NutritionRecommendationResult {
  summary: string;
  meals: NutritionRecommendationMeals;
  tips: string[];
  referencedFoods: NutritionFoodCard[];
  knowledgeMeta: {
    guidelineCount: number;
    foodCount: number;
  };
}

export interface RecommendNutritionPayload {
  goal: NutritionGoal;
  preferences: NutritionPreference[];
  note: string;
}
