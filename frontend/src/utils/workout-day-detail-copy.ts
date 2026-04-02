import type { WorkoutDayDetailView } from '@/types/workout';

export const getWorkoutDayDetailHint = (detail: WorkoutDayDetailView): string => {
  if (detail.canViewPlan) {
    return detail.planGoalText?.trim() || '这次训练来自一份可回看的历史计划。';
  }

  if (detail.planMissing) {
    return '原训练计划已删除，无法回看详情。';
  }

  return '这条记录来自手动补录，不会关联历史计划。';
};

export const getWorkoutDayDetailPlanLabel = (detail: WorkoutDayDetailView): string | null => {
  if (!detail.canViewPlan) {
    return null;
  }

  return detail.planTitle?.trim() || '关联训练计划';
};
