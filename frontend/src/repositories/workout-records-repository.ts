import { fitMirrorDb } from '@/db';
import type { WorkoutRecordEntity } from '@/types/local-db';

const toRepositoryError = (action: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`[workoutRecordsRepository] ${action} failed: ${message}`);
};

export const workoutRecordsRepository = {
  async createRecord(
    payload: Omit<WorkoutRecordEntity, 'id' | 'clientRecordId' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<WorkoutRecordEntity, 'clientRecordId' | 'createdAt' | 'updatedAt'>>
  ): Promise<WorkoutRecordEntity> {
    try {
      const now = new Date().toISOString();
      const record: Omit<WorkoutRecordEntity, 'id'> = {
        ...payload,
        clientRecordId: payload.clientRecordId ?? createClientRecordId(),
        createdAt: payload.createdAt ?? now,
        updatedAt: payload.updatedAt ?? now
      };

      const id = await fitMirrorDb.workoutRecords.add(record);
      return { ...record, id: Number(id) };
    } catch (error) {
      throw toRepositoryError('createRecord', error);
    }
  },

  async listRecordsByUser(userId: number): Promise<WorkoutRecordEntity[]> {
    try {
      const records = await fitMirrorDb.workoutRecords.where('userId').equals(userId).toArray();
      return records.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date > b.date ? 1 : -1;
        }

        return a.createdAt > b.createdAt ? 1 : -1;
      });
    } catch (error) {
      throw toRepositoryError('listRecordsByUser', error);
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
  },

  async replaceRecordsForUser(userId: number, records: Omit<WorkoutRecordEntity, 'id' | 'userId'>[]): Promise<void> {
    try {
      await fitMirrorDb.transaction('rw', fitMirrorDb.workoutRecords, async () => {
        await fitMirrorDb.workoutRecords.where('userId').equals(userId).delete();
        if (records.length === 0) {
          return;
        }

        await fitMirrorDb.workoutRecords.bulkAdd(records.map((record) => ({ ...record, userId })));
      });
    } catch (error) {
      throw toRepositoryError('replaceRecordsForUser', error);
    }
  }
};

const createClientRecordId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
