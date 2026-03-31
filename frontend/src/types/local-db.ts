import type { TrainingPlan } from '@/types/plan';

export interface PlanEntity {
  id?: number;
  userId: number;
  goalText: string;
  planJson: TrainingPlan;
  createdAt: string;
}

export interface WorkoutRecordEntity {
  id?: number;
  userId: number;
  date: string;
  duration: number;
  completed: boolean;
  planId?: number;
}

export interface ExercisePreferenceEntity {
  id?: number;
  userId: number;
  exerciseId: string;
  isFavorite: boolean;
  lastViewedAt?: string;
  updatedAt: string;
}

export interface UserSettingsEntity {
  userId: number;
  theme: 'dark' | 'light';
  unit: 'metric' | 'imperial';
  updatedAt: string;
}
