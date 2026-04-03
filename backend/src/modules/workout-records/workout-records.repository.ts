import { prisma } from '../../lib/prisma';
import type { WorkoutRecordSyncInput } from './workout-records.schema';

export const workoutRecordsRepository = {
  async syncRecords(userId: number, records: WorkoutRecordSyncInput[]) {
    return prisma.$transaction(async (tx) => {
      const incomingClientRecordIds = records.map((record) => record.clientRecordId);

      if (incomingClientRecordIds.length === 0) {
        await tx.workoutRecord.deleteMany({
          where: { userId }
        });
      } else {
        await tx.workoutRecord.deleteMany({
          where: {
            userId,
            clientRecordId: {
              notIn: incomingClientRecordIds
            }
          }
        });
      }

      for (const record of records) {
        const existing = await tx.workoutRecord.findUnique({
          where: {
            userId_clientRecordId: {
              userId,
              clientRecordId: record.clientRecordId
            }
          }
        });

        if (!existing) {
          await tx.workoutRecord.create({
            data: {
              userId,
              clientRecordId: record.clientRecordId,
              date: record.date,
              duration: record.duration,
              completed: record.completed,
              planId: record.planId,
              createdAt: new Date(record.createdAt),
              updatedAt: new Date(record.updatedAt)
            }
          });
          continue;
        }

        if (existing.updatedAt.getTime() > new Date(record.updatedAt).getTime()) {
          continue;
        }

        await tx.workoutRecord.update({
          where: {
            userId_clientRecordId: {
              userId,
              clientRecordId: record.clientRecordId
            }
          },
          data: {
            date: record.date,
            duration: record.duration,
            completed: record.completed,
            planId: record.planId,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt)
          }
        });
      }

      return tx.workoutRecord.findMany({
        where: { userId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
      });
    });
  }
};
