import { fitMirrorDb } from '@/db';
import type { WorkoutRecordEntity } from '@/types/local-db';

const toRepositoryError = (action: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`[workoutRecordsRepository] ${action} failed: ${message}`);
};

export const workoutRecordsRepository = {
  async createRecord(payload: Omit<WorkoutRecordEntity, 'id'>): Promise<WorkoutRecordEntity> {
    try {
      const id = await fitMirrorDb.workoutRecords.add(payload);
      return { ...payload, id: Number(id) };
    } catch (error) {
      throw toRepositoryError('createRecord', error);
    }
  },

  async listRecordsByDateRange(userId: number, startDate: string, endDate: string): Promise<WorkoutRecordEntity[]> {
    try {
      const records = await fitMirrorDb.workoutRecords.where('userId').equals(userId).toArray();
      return records
        .filter((record) => record.date >= startDate && record.date <= endDate)
        .sort((a, b) => (a.date > b.date ? 1 : -1));
    } catch (error) {
      throw toRepositoryError('listRecordsByDateRange', error);
    }
  },

  async listRecordsByDay(userId: number, date: string): Promise<WorkoutRecordEntity[]> {
    try {
      const records = await fitMirrorDb.workoutRecords.where('[userId+date]').equals([userId, date]).toArray();
      return records.sort((a, b) => Number(Boolean(b.completed)) - Number(Boolean(a.completed)));
    } catch (error) {
      throw toRepositoryError('listRecordsByDay', error);
    }
  }
};
