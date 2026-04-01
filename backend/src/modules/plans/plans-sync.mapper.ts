interface PersistedPlanRecord {
  clientPlanId: string;
  goalText: string;
  planJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncedPlanDto {
  clientPlanId: string;
  goalText: string;
  planJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export const toSyncedPlanDto = (plan: PersistedPlanRecord): SyncedPlanDto => ({
  clientPlanId: plan.clientPlanId,
  goalText: plan.goalText,
  planJson: plan.planJson,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString()
});
