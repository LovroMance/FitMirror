import { describe, expect, it } from 'vitest';
import { parseRecommendNutritionBody } from './nutrition.schema';

describe('nutrition.schema', () => {
  it('parses valid input', () => {
    expect(
      parseRecommendNutritionBody({
        goal: 'fat_loss',
        preferences: ['high_protein', 'quick'],
        avoidances: '不吃辣'
      })
    ).toEqual({
      goal: 'fat_loss',
      preferences: ['high_protein', 'quick'],
      avoidances: '不吃辣'
    });
  });

  it('throws when goal is missing', () => {
    expect(() =>
      parseRecommendNutritionBody({
        preferences: [],
        avoidances: ''
      })
    ).toThrowError('goal is invalid');
  });

  it('throws when goal is invalid', () => {
    expect(() =>
      parseRecommendNutritionBody({
        goal: 'bulk',
        preferences: [],
        avoidances: ''
      })
    ).toThrowError('goal is invalid');
  });

  it('throws when preferences is not array', () => {
    expect(() =>
      parseRecommendNutritionBody({
        goal: 'fat_loss',
        preferences: 'high_protein',
        avoidances: ''
      })
    ).toThrowError('preferences must be an array');
  });

  it('throws when avoidances is too long', () => {
    expect(() =>
      parseRecommendNutritionBody({
        goal: 'fat_loss',
        preferences: [],
        avoidances: 'a'.repeat(201)
      })
    ).toThrowError('avoidances is too long');
  });
});
