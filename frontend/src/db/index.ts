import Dexie, { type Table } from 'dexie';
import type {
  ExercisePreferenceEntity,
  PlanEntity,
  UserSettingsEntity,
  WorkoutRecordEntity
} from '@/types/local-db';

class FitMirrorDb extends Dexie {
  plans!: Table<PlanEntity, number>;
  workoutRecords!: Table<WorkoutRecordEntity, number>;
  exercisePreferences!: Table<ExercisePreferenceEntity, number>;
  settings!: Table<UserSettingsEntity, number>;

  constructor() {
    super('fitmirror_local_db');

    this.version(1).stores({
      plans: '++id, userId, createdAt, [userId+createdAt]',
      workout_records: '++id, userId, date, completed, planId, [userId+date]',
      settings: 'userId, updatedAt'
    });

    this.version(2).stores({
      plans: '++id, userId, createdAt, [userId+createdAt]',
      workout_records: '++id, userId, date, completed, planId, [userId+date]',
      exercise_preferences: '++id, userId, exerciseId, isFavorite, lastViewedAt, updatedAt, [userId+exerciseId]',
      settings: 'userId, updatedAt'
    });

    this.version(3)
      .stores({
        plans: '++id, userId, createdAt, [userId+createdAt]',
        workout_records:
          '++id, userId, clientRecordId, date, completed, planId, updatedAt, [userId+date], [userId+clientRecordId]',
        exercise_preferences: '++id, userId, exerciseId, isFavorite, lastViewedAt, updatedAt, [userId+exerciseId]',
        settings: 'userId, updatedAt'
      })
      .upgrade(async (tx) => {
        const table = tx.table('workout_records');
        const records = await table.toArray();

        await Promise.all(
          records.map((record) =>
            table.put({
              ...record,
              clientRecordId: String(record.clientRecordId ?? `legacy-${record.id ?? Date.now()}-${Math.random()}`),
              createdAt: String(record.createdAt ?? new Date().toISOString()),
              updatedAt: String(record.updatedAt ?? new Date().toISOString())
            })
          )
        );
      });

    this.plans = this.table('plans');
    this.workoutRecords = this.table('workout_records');
    this.exercisePreferences = this.table('exercise_preferences');
    this.settings = this.table('settings');
  }
}

export const fitMirrorDb = new FitMirrorDb();
