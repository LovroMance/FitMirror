import type { ExerciseItem } from '@/types/exercise';
import type { PlanExercise } from '@/types/plan';

export const createPlanExerciseFromExerciseLibraryItem = (exerciseItem: ExerciseItem): PlanExercise => ({
  name: exerciseItem.name,
  reps: exerciseItem.reps,
  restSeconds: 20,
  instruction: exerciseItem.instructions[0] ?? exerciseItem.description
});
