import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { recommendNutritionController } from './nutrition.controller';

const nutritionRouter = Router();

nutritionRouter.post('/recommend', requireAuth, recommendNutritionController);

export { nutritionRouter };
