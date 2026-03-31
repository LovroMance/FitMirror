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

export type PlanSource = 'deepseek' | 'template';

export interface GeneratePlanPayload {
  plan: TrainingPlan;
  source?: PlanSource;
}

export interface PersistedPlan {
  goalText: string;
  createdAt: string;
  plan: TrainingPlan;
}

export type PlanStreamStatus =
  | 'queued'
  | 'llm_start'
  | 'llm_done'
  | 'llm_failed'
  | 'fallback_start'
  | 'completed'
  | 'error';

export interface PlanStreamEvent {
  type: PlanStreamStatus;
  source?: PlanSource;
  reason?: string;
  plan?: TrainingPlan;
  message?: string;
}
