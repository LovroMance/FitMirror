import { fitMirrorDb } from '@/db';
import type { PlanEntity } from '@/types/local-db';
import type { PersistedPlan, TrainingPlan } from '@/types/plan';

const LEGACY_LATEST_PLAN_KEY = 'fitmirror_latest_plan';
const LEGACY_MIGRATION_MARKER_KEY = 'fitmirror_latest_plan_migrated_v1';

const toRepositoryError = (action: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`[plansRepository] ${action} failed: ${message}`);
};

const parseLegacyPlan = (raw: string): PersistedPlan | null => {
  try {
    const parsed = JSON.parse(raw) as PersistedPlan;

    if (
      typeof parsed.goalText !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.plan !== 'object' ||
      parsed.plan === null
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const insertPlanEntity = async (entity: Omit<PlanEntity, 'id'>): Promise<PlanEntity> => {
  const id = await fitMirrorDb.plans.add(entity);
  return { ...entity, id: Number(id) };
};

const migrateLegacyLatestPlanOnce = async (userId: number): Promise<void> => {
  if (localStorage.getItem(LEGACY_MIGRATION_MARKER_KEY) === '1') {
    return;
  }

  const raw = localStorage.getItem(LEGACY_LATEST_PLAN_KEY);
  if (!raw) {
    localStorage.setItem(LEGACY_MIGRATION_MARKER_KEY, '1');
    return;
  }

  const legacyPlan = parseLegacyPlan(raw);
  if (legacyPlan) {
    await insertPlanEntity({
      userId,
      goalText: legacyPlan.goalText,
      planJson: legacyPlan.plan,
      createdAt: legacyPlan.createdAt
    });
  }

  localStorage.removeItem(LEGACY_LATEST_PLAN_KEY);
  localStorage.setItem(LEGACY_MIGRATION_MARKER_KEY, '1');
};

export const plansRepository = {
  async saveLatestPlan(params: { userId: number; goalText: string; plan: TrainingPlan }): Promise<PlanEntity> {
    try {
      return await insertPlanEntity({
        userId: params.userId,
        goalText: params.goalText,
        planJson: params.plan,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      throw toRepositoryError('saveLatestPlan', error);
    }
  },

  async loadLatestPlan(userId: number): Promise<PlanEntity | null> {
    try {
      await migrateLegacyLatestPlanOnce(userId);

      const plans = await fitMirrorDb.plans.where('userId').equals(userId).sortBy('createdAt');
      if (plans.length === 0) {
        return null;
      }

      return plans[plans.length - 1];
    } catch (error) {
      throw toRepositoryError('loadLatestPlan', error);
    }
  },

  async deletePlan(userId: number, planId?: number): Promise<void> {
    try {
      if (typeof planId === 'number') {
        const target = await fitMirrorDb.plans.get(planId);
        if (target?.userId === userId) {
          await fitMirrorDb.plans.delete(planId);
        }
        return;
      }

      const latest = await plansRepository.loadLatestPlan(userId);
      if (latest?.id) {
        await fitMirrorDb.plans.delete(latest.id);
      }
    } catch (error) {
      throw toRepositoryError('deletePlan', error);
    }
  },

  async listPlansByUser(userId: number): Promise<PlanEntity[]> {
    try {
      const plans = await fitMirrorDb.plans.where('userId').equals(userId).sortBy('createdAt');
      return plans.reverse();
    } catch (error) {
      throw toRepositoryError('listPlansByUser', error);
    }
  }
};

