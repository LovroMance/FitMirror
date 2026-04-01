import { prisma } from '../../lib/prisma';
import type { PlanSyncInput } from './plans-sync.schema';

export const plansSyncRepository = {
  async syncPlans(userId: number, plans: PlanSyncInput[], deletedClientPlanIds: string[]) {
    return prisma.$transaction(async (tx) => {
      const planClient = (tx as typeof prisma).plan;

      for (const plan of plans) {
        const existing = await planClient.findUnique({
          where: {
            userId_clientPlanId: {
              userId,
              clientPlanId: plan.clientPlanId
            }
          }
        });

        if (!existing) {
          await planClient.create({
            data: {
              userId,
              clientPlanId: plan.clientPlanId,
              goalText: plan.goalText,
              planJson: plan.planJson as object,
              createdAt: new Date(plan.createdAt),
              updatedAt: new Date(plan.updatedAt)
            }
          });
          continue;
        }

        if (existing.updatedAt.getTime() > new Date(plan.updatedAt).getTime()) {
          continue;
        }

        await planClient.update({
          where: {
            userId_clientPlanId: {
              userId,
              clientPlanId: plan.clientPlanId
            }
          },
          data: {
            goalText: plan.goalText,
            planJson: plan.planJson as object,
            createdAt: new Date(plan.createdAt),
            updatedAt: new Date(plan.updatedAt)
          }
        });
      }

      if (deletedClientPlanIds.length > 0) {
        await planClient.deleteMany({
          where: {
            userId,
            clientPlanId: {
              in: deletedClientPlanIds
            }
          }
        });
      }

      return planClient.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }]
      });
    });
  }
};
