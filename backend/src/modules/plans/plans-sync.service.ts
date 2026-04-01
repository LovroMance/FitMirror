import { toSyncedPlanDto } from './plans-sync.mapper';
import { plansSyncRepository } from './plans-sync.repository';
import type { SyncPlansBody } from './plans-sync.schema';

export const syncPlans = async (userId: number, input: SyncPlansBody) => {
  const plans = await plansSyncRepository.syncPlans(userId, input.plans, input.deletedClientPlanIds);

  return {
    plans: plans.map((plan) => toSyncedPlanDto(plan))
  };
};
