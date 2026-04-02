import dayjs from 'dayjs';
import type { WorkoutRecordEntity } from '@/types/local-db';
import type { PlanHistoryFilter, PlanHistoryItemView } from '@/types/plan';

interface PlanUsageSummary {
  count: number;
  lastUsedAt: string;
}

export const buildPlanUsageMap = (records: WorkoutRecordEntity[]): Map<number, PlanUsageSummary> => {
  const usage = new Map<number, PlanUsageSummary>();

  records.forEach((record) => {
    if (typeof record.planId !== 'number' || record.planId <= 0) {
      return;
    }

    const current = usage.get(record.planId);
    const timestamp = record.updatedAt ?? record.createdAt ?? `${record.date}T00:00:00.000Z`;

    if (!current) {
      usage.set(record.planId, { count: 1, lastUsedAt: timestamp });
      return;
    }

    usage.set(record.planId, {
      count: current.count + 1,
      lastUsedAt: current.lastUsedAt > timestamp ? current.lastUsedAt : timestamp
    });
  });

  return usage;
};

export const decoratePlanHistoryItems = (
  items: PlanHistoryItemView[],
  usageMap: Map<number, PlanUsageSummary>
): PlanHistoryItemView[] => {
  const latestPlanId =
    [...usageMap.entries()].sort((a, b) => {
      if (a[1].lastUsedAt === b[1].lastUsedAt) {
        return b[1].count - a[1].count;
      }

      return dayjs(b[1].lastUsedAt).valueOf() - dayjs(a[1].lastUsedAt).valueOf();
    })[0]?.[0] ?? null;

  return items.map((item) => {
    const usage = usageMap.get(item.id);
    if (!usage) {
      return item;
    }

    return {
      ...item,
      usedWorkoutCount: usage.count,
      lastUsedAt: usage.lastUsedAt,
      usageBadge: item.id === latestPlanId ? '最近使用' : '已用于训练'
    };
  });
};

const toTimestamp = (value: string | null): number => {
  if (!value) {
    return 0;
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.valueOf() : 0;
};

export const sortPlanHistoryItems = (items: PlanHistoryItemView[]): PlanHistoryItemView[] => {
  return [...items].sort((left, right) => {
    const leftUsed = left.usedWorkoutCount > 0;
    const rightUsed = right.usedWorkoutCount > 0;

    if (leftUsed !== rightUsed) {
      return Number(rightUsed) - Number(leftUsed);
    }

    if (leftUsed && rightUsed) {
      const usageDelta = toTimestamp(right.lastUsedAt) - toTimestamp(left.lastUsedAt);
      if (usageDelta !== 0) {
        return usageDelta;
      }

      if (left.usedWorkoutCount !== right.usedWorkoutCount) {
        return right.usedWorkoutCount - left.usedWorkoutCount;
      }
    }

    const createdDelta = toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
    if (createdDelta !== 0) {
      return createdDelta;
    }

    return right.id - left.id;
  });
};

export const filterPlanHistoryItems = (
  items: PlanHistoryItemView[],
  filter: PlanHistoryFilter
): PlanHistoryItemView[] => {
  if (filter === 'used') {
    return items.filter((item) => item.usedWorkoutCount > 0);
  }

  if (filter === 'unused') {
    return items.filter((item) => item.usedWorkoutCount === 0);
  }

  return items;
};
