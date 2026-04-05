export type NutritionGoal = 'fat_loss' | 'muscle_gain' | 'maintenance';

export type NutritionPreference = 'high_protein' | 'low_oil' | 'light' | 'quick';

export interface RecommendNutritionInput {
  goal: NutritionGoal;
  preferences: NutritionPreference[];
  note: string;
}

export interface NutritionGuideline {
  id: string;
  title: string;
  goalTags: NutritionGoal[];
  preferenceTags: NutritionPreference[];
  mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'>;
  keywords: string[];
  summary: string;
  content: string;
  priority: number;
}

export interface NutritionFood {
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

export type NutritionFoodCard = NutritionFood;

export interface NutritionNoteResponse {
  input: string;
  type: 'question' | 'constraint' | 'mixed' | 'general';
  title: string;
  summary: string;
  bullets: string[];
}

export interface NutritionMealRecommendation {
  title: string;
  suggestedFoods: string[];
  suggestedPortions: string[];
  why: string;
  alternatives: string[];
  detail: string;
}

export interface NutritionRecommendationMeals {
  breakfast: NutritionMealRecommendation;
  lunch: NutritionMealRecommendation;
  dinner: NutritionMealRecommendation;
  snack: NutritionMealRecommendation;
}

export interface NutritionKnowledgeMeta {
  guidelineCount: number;
  foodCount: number;
  source: 'llm' | 'fallback';
}

export interface NutritionRecommendationResult {
  summary: string;
  noteResponse: NutritionNoteResponse | null;
  meals: NutritionRecommendationMeals;
  tips: string[];
  referencedFoods: NutritionFoodCard[];
  knowledgeMeta: NutritionKnowledgeMeta;
}
