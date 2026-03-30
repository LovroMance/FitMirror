import Dexie, { type Table } from 'dexie';
import type { PlanEntity, UserSettingsEntity, WorkoutRecordEntity } from '@/types/local-db';

class FitMirrorDb extends Dexie {
  plans!: Table<PlanEntity, number>;
  workoutRecords!: Table<WorkoutRecordEntity, number>;
  settings!: Table<UserSettingsEntity, number>;

  constructor() {
    super('fitmirror_local_db');

    this.version(1).stores({
      plans: '++id, userId, createdAt, [userId+createdAt]',
      workout_records: '++id, userId, date, completed, planId, [userId+date]',
      settings: 'userId, updatedAt'
    });

    this.plans = this.table('plans');
    this.workoutRecords = this.table('workout_records');
    this.settings = this.table('settings');
  }
}

export const fitMirrorDb = new FitMirrorDb();
