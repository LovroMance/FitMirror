import { describe, expect, it } from 'vitest';
import { parseRecommendNutritionBody } from './nutrition.schema';

describe('nutrition.schema', () => {
  it('parses valid input', () => {
    expect(
      parseRecommendNutritionBody({
        goal: 'fat_loss',
        preferences: ['high_protein', 'quick'],
        note: '不吃辣'
      })
    ).toEqual({
      goal: 'fat_loss',
      preferences: ['high_protein', 'quick'],
      note: '不吃辣'
    });
  });

  it('throws when goal is missing', () => {
    expect(() =>
      parseRecommendNutritionBody({
        preferences: [],
        note: ''
      })
    ).toThrowError('goal is invalid');
  });

  it('throws when goal is invalid', () => {
    expect(() =>
      parseRecommendNutritionBody({
        goal: 'bulk',
        preferences: [],
        note: ''
      })
    ).toThrowError('goal is invalid');
  });

  it('throws when preferences is not array', () => {
    expect(() =>
      parseRecommendNutritionBody({
        goal: 'fat_loss',
        preferences: 'high_protein',
        note: ''
      })
    ).toThrowError('preferences must be an array');
  });

  it('throws when note is too long', () => {
    expect(() =>
      parseRecommendNutritionBody({
        goal: 'fat_loss',
        preferences: [],
        note: 'a'.repeat(201)
      })
    ).toThrowError('note is too long');
  });
});
