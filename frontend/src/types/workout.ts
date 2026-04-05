import type { WorkoutRecordEntity } from '@/types/local-db';

export interface DailyHeatmapPoint {
  date: string;
  count: number;
  completedCount: number;
  totalDuration: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  records: WorkoutRecordEntity[];
}

export interface WorkoutSummary {
  trainingDays: number;
  totalDuration: number;
  streakDays: number;
}

export type WorkoutPeriod = 'week' | 'month';

export interface WorkoutTrendSummary {
  trainingDays: number;
  totalDuration: number;
  averageDuration: number;
  busiestDate: string | null;
}

export type WorkoutRecordSourceType = 'plan' | 'manual';
export type WorkoutLogCompletionFilter = 'all' | 'completed' | 'incomplete';
export type WorkoutLogDurationFilter = 'all' | 'short' | 'medium' | 'long';

export interface WorkoutDayDetailView {
  id?: number;
  clientRecordId: string;
  date: string;
  duration: number;
  completed: boolean;
  isJustCompleted: boolean;
  sourceType: WorkoutRecordSourceType;
  sourceLabel: string;
  planId: number | null;
  planTitle: string | null;
  planGoalText: string | null;
  canViewPlan: boolean;
  planMissing: boolean;
}

export interface WorkoutLogRecordListItem {
  clientRecordId: string;
  date: string;
  duration: number;
  completed: boolean;
  planId: number | null;
  title: string;
  subtitle: string;
  goalText: string | null;
  sourceLabel: string;
}

export interface WorkoutRecordSyncPayload {
  clientRecordId: string;
  date: string;
  duration: number;
  completed: boolean;
  planId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncWorkoutRecordsResult {
  records: WorkoutRecordSyncPayload[];
}
