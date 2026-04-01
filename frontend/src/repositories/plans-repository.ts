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

const createClientPlanId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    const now = legacyPlan.createdAt;
    await insertPlanEntity({
      userId,
      clientPlanId: createClientPlanId(),
      goalText: legacyPlan.goalText,
      planJson: legacyPlan.plan,
      createdAt: legacyPlan.createdAt,
      updatedAt: now
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
        clientPlanId: createClientPlanId(),
        goalText: params.goalText,
        planJson: params.plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

  async getPlanById(userId: number, planId: number): Promise<PlanEntity | null> {
    try {
      const target = await fitMirrorDb.plans.get(planId);
      if (!target || target.userId !== userId) {
        return null;
      }

      return target;
    } catch (error) {
      throw toRepositoryError('getPlanById', error);
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
  },

  async listPlansByUserAsc(userId: number): Promise<PlanEntity[]> {
    try {
      return await fitMirrorDb.plans.where('userId').equals(userId).sortBy('createdAt');
    } catch (error) {
      throw toRepositoryError('listPlansByUserAsc', error);
    }
  },

  async replacePlansForUser(userId: number, plans: Omit<PlanEntity, 'id' | 'userId'>[]): Promise<void> {
    try {
      await fitMirrorDb.transaction('rw', fitMirrorDb.plans, async () => {
        await fitMirrorDb.plans.where('userId').equals(userId).delete();
        if (plans.length === 0) {
          return;
        }

        await fitMirrorDb.plans.bulkAdd(plans.map((plan) => ({ ...plan, userId })));
      });
    } catch (error) {
      throw toRepositoryError('replacePlansForUser', error);
    }
  }
};

