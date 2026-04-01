import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { generatePlan, streamGeneratedPlan } from './plans.controller';
import { syncPlansController } from './plans-sync.controller';

const plansRouter = Router();

plansRouter.post('/generate', requireAuth, generatePlan);
plansRouter.get('/generate/stream', requireAuth, streamGeneratedPlan);
plansRouter.post('/sync', requireAuth, syncPlansController);

export { plansRouter };
