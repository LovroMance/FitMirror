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
export type PlanDisplaySource = PlanSource | 'restored' | 'edited';

export interface EditableTrainingPlanDraft {
  title: string;
  level: TrainingPlan['level'];
  durationMinutes: number;
  summary: string;
  exercises: PlanExercise[];
}

export interface PlanEditingSessionSnapshot {
  latestPlanId: number;
  goalText: string;
  editablePlanDraft: EditableTrainingPlanDraft;
}

export interface PlanExerciseReplacementSummary {
  previousName: string;
  nextName: string;
}

export interface PlanEditChangeSummary {
  titleChanged: boolean;
  durationChanged: boolean;
  reordered: boolean;
  addedExerciseNames: string[];
  removedExerciseNames: string[];
  replacedExercises: PlanExerciseReplacementSummary[];
  nextDurationMinutes: number;
  hasChanges: boolean;
}

export interface PlanExerciseChangeMarker {
  kind: 'added' | 'replaced';
  label: string;
  previousName?: string;
}

export interface GeneratePlanPayload {
  plan: TrainingPlan;
  source?: PlanSource;
}

export interface PersistedPlan {
  goalText: string;
  createdAt: string;
  plan: TrainingPlan;
}

export interface PlanHistoryItemView {
  id: number;
  clientPlanId: string;
  goalText: string;
  createdAt: string;
  title: string;
  durationMinutes: number;
  level: TrainingPlan['level'];
  summary: string;
  exercises: PlanExercise[];
  exerciseCount: number;
  isValid: boolean;
  usedWorkoutCount: number;
  lastUsedAt: string | null;
  usageBadge: string | null;
}

export type PlanHistoryFilter = 'all' | 'used' | 'unused';

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

export interface PlanSyncPayload {
  clientPlanId: string;
  goalText: string;
  planJson: TrainingPlan;
  createdAt: string;
  updatedAt: string;
}

export interface SyncPlansRequest {
  plans: PlanSyncPayload[];
  deletedClientPlanIds: string[];
}

export interface SyncPlansResult {
  plans: PlanSyncPayload[];
}

