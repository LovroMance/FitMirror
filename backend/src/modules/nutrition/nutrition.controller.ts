import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { sendSuccess } from '../../utils/response';
import { toNutritionRecommendationDto } from './nutrition.mapper';
import { parseRecommendNutritionBody } from './nutrition.schema';
import { recommendNutrition } from './nutrition.service';

export const recommendNutritionController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = parseRecommendNutritionBody(req.body);
    const result = await recommendNutrition(input);
    sendSuccess(res, toNutritionRecommendationDto(result));
  } catch (error) {
    next(error);
  }
};
