import type { PlanEntity, WorkoutRecordEntity } from '@/types/local-db';
import type { WorkoutDayDetailView } from '@/types/workout';

const toSourceType = (record: WorkoutRecordEntity): WorkoutDayDetailView['sourceType'] =>
  typeof record.planId === 'number' && record.planId > 0 ? 'plan' : 'manual';

const toSourceLabel = (record: WorkoutRecordEntity): string => (toSourceType(record) === 'plan' ? '计划训练' : '手动记录');

export const buildWorkoutDayDetailViews = (
  records: WorkoutRecordEntity[],
  plansById: Map<number, PlanEntity>
): WorkoutDayDetailView[] =>
  records.map((record) => {
    const planId = typeof record.planId === 'number' && record.planId > 0 ? record.planId : null;
    const linkedPlan = planId ? plansById.get(planId) ?? null : null;

    return {
      id: record.id,
      date: record.date,
      duration: record.duration,
      completed: record.completed,
      isJustCompleted: false,
      sourceType: toSourceType(record),
      sourceLabel: toSourceLabel(record),
      planId,
      planTitle: linkedPlan?.planJson.title ?? null,
      planGoalText: linkedPlan?.goalText ?? null,
      canViewPlan: Boolean(linkedPlan && planId),
      planMissing: Boolean(planId && !linkedPlan)
    };
  });
