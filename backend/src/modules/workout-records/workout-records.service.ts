import { toWorkoutRecordDto } from './workout-records.mapper';
import { workoutRecordsRepository } from './workout-records.repository';
import type { SyncWorkoutRecordsBody } from './workout-records.schema';

export const syncWorkoutRecords = async (userId: number, input: SyncWorkoutRecordsBody) => {
  const records = await workoutRecordsRepository.syncRecords(userId, input.records);

  return {
    records: records.map((record) => toWorkoutRecordDto(record))
  };
};
