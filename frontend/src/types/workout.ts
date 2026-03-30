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
