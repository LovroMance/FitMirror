import { syncPlansApi } from '@/api/plans-sync';
import { planSyncStateRepository, plansRepository } from '@/repositories';
import type { PlanEntity } from '@/types/local-db';

const syncTasks = new Map<number, Promise<void>>();

const toSyncPayload = (plan: PlanEntity) => ({
  clientPlanId: plan.clientPlanId,
  goalText: plan.goalText,
  planJson: plan.planJson,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt
});

export const syncPlansForUser = async (userId: number): Promise<void> => {
  const existingTask = syncTasks.get(userId);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    const localPlans = await plansRepository.listPlansByUserAsc(userId);
    const deletedClientPlanIds = await planSyncStateRepository.listPendingDeletedPlanIds(userId);
    const result = await syncPlansApi({
      plans: localPlans.map((plan) => toSyncPayload(plan)),
      deletedClientPlanIds
    });
    await plansRepository.replacePlansForUser(userId, result.plans);
    await planSyncStateRepository.clearPendingDeletedPlanIds(userId, deletedClientPlanIds);
  })();

  syncTasks.set(userId, task);

  try {
    await task;
  } finally {
    syncTasks.delete(userId);
  }
};
