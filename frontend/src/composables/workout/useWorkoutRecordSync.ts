import { syncWorkoutRecordsApi } from '@/api/workout-records';
import { workoutRecordsRepository } from '@/repositories';
import type { WorkoutRecordEntity } from '@/types/local-db';

const syncTasks = new Map<number, Promise<void>>();

const toSyncPayload = (record: WorkoutRecordEntity) => ({
  clientRecordId: record.clientRecordId,
  date: record.date,
  duration: record.duration,
  completed: record.completed,
  ...(typeof record.planId === 'number' ? { planId: record.planId } : {}),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

export const syncWorkoutRecordsForUser = async (userId: number): Promise<void> => {
  const existingTask = syncTasks.get(userId);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    const localRecords = await workoutRecordsRepository.listRecordsByUser(userId);
    const result = await syncWorkoutRecordsApi(localRecords.map((record) => toSyncPayload(record)));
    await workoutRecordsRepository.replaceRecordsForUser(userId, result.records);
  })();

  syncTasks.set(userId, task);

  try {
    await task;
  } finally {
    syncTasks.delete(userId);
  }
};
