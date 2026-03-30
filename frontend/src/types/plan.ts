export interface PlanExercise {
  name: string;
  durationSeconds?: number;
  reps?: string;
  restSeconds: number;
  instruction: string;
}

export interface TrainingPlan {
  title: string;
  level: 'beginner' | 'intermediate';
  durationMinutes: number;
  summary: string;
  exercises: PlanExercise[];
}

export interface GeneratePlanPayload {
  plan: TrainingPlan;
}

export interface PersistedPlan {
  goalText: string;
  createdAt: string;
  plan: TrainingPlan;
}
