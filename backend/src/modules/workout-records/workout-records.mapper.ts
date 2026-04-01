import type { WorkoutRecord } from '@prisma/client';

export interface WorkoutRecordDto {
  clientRecordId: string;
  date: string;
  duration: number;
  completed: boolean;
  planId?: number;
  createdAt: string;
  updatedAt: string;
}

export const toWorkoutRecordDto = (record: WorkoutRecord): WorkoutRecordDto => ({
  clientRecordId: record.clientRecordId,
  date: record.date,
  duration: record.duration,
  completed: record.completed,
  ...(typeof record.planId === 'number' ? { planId: record.planId } : {}),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});
