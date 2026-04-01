import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { syncWorkoutRecordsController } from './workout-records.controller';

const workoutRecordsRouter = Router();

workoutRecordsRouter.post('/sync', requireAuth, syncWorkoutRecordsController);

export { workoutRecordsRouter };
