import type { TrainingPlan } from '@/types/plan';

export interface PlanEntity {
  id?: number;
  userId: number;
  clientPlanId: string;
  goalText: string;
  planJson: TrainingPlan;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutRecordEntity {
  id?: number;
  userId: number;
  clientRecordId: string;
  date: string;
  duration: number;
  completed: boolean;
  planId?: number;
  createdAt: string;
  updatedAt: string;
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
