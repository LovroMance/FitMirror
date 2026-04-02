import type { PlanEditChangeSummary, TrainingPlan } from '@/types/plan';

const buildExerciseNameCountMap = (exerciseNames: string[]): Map<string, number> => {
  const countMap = new Map<string, number>();

  for (const exerciseName of exerciseNames) {
    countMap.set(exerciseName, (countMap.get(exerciseName) ?? 0) + 1);
  }

  return countMap;
};

const expandExerciseNameDiff = (sourceNames: string[], targetNames: string[]): string[] => {
  const targetCountMap = buildExerciseNameCountMap(targetNames);
  const diffNames: string[] = [];

  for (const sourceName of sourceNames) {
    const remainingCount = targetCountMap.get(sourceName) ?? 0;
    if (remainingCount > 0) {
      targetCountMap.set(sourceName, remainingCount - 1);
      continue;
    }

    diffNames.push(sourceName);
  }

  return diffNames;
};

const haveSameExerciseNames = (previousNames: string[], nextNames: string[]): boolean => {
  if (previousNames.length !== nextNames.length) {
    return false;
  }

  const previousCountMap = buildExerciseNameCountMap(previousNames);
  const nextCountMap = buildExerciseNameCountMap(nextNames);

  if (previousCountMap.size !== nextCountMap.size) {
    return false;
  }

  for (const [exerciseName, previousCount] of previousCountMap.entries()) {
    if (nextCountMap.get(exerciseName) !== previousCount) {
      return false;
    }
  }

  return true;
};

export const buildPlanEditChangeSummary = (previousPlan: TrainingPlan, nextPlan: TrainingPlan): PlanEditChangeSummary => {
  const previousExerciseNames = previousPlan.exercises.map((exercise) => exercise.name);
  const nextExerciseNames = nextPlan.exercises.map((exercise) => exercise.name);
  const addedExerciseNames = expandExerciseNameDiff(nextExerciseNames, previousExerciseNames);
  const removedExerciseNames = expandExerciseNameDiff(previousExerciseNames, nextExerciseNames);
  const replacementCount = Math.min(addedExerciseNames.length, removedExerciseNames.length);
  const replacedExercises = Array.from({ length: replacementCount }, (_value, index) => ({
    previousName: removedExerciseNames[index],
    nextName: addedExerciseNames[index]
  }));
  const remainingAddedExerciseNames = addedExerciseNames.slice(replacementCount);
  const remainingRemovedExerciseNames = removedExerciseNames.slice(replacementCount);
  const reordered =
    replacedExercises.length === 0 &&
    haveSameExerciseNames(previousExerciseNames, nextExerciseNames) &&
    previousExerciseNames.some((exerciseName, index) => exerciseName !== nextExerciseNames[index]);
  const titleChanged = previousPlan.title.trim() !== nextPlan.title.trim();
  const durationChanged = previousPlan.durationMinutes !== nextPlan.durationMinutes;

  return {
    titleChanged,
    durationChanged,
    reordered,
    addedExerciseNames: remainingAddedExerciseNames,
    removedExerciseNames: remainingRemovedExerciseNames,
    replacedExercises,
    nextDurationMinutes: nextPlan.durationMinutes,
    hasChanges:
      titleChanged ||
      durationChanged ||
      reordered ||
      remainingAddedExerciseNames.length > 0 ||
      remainingRemovedExerciseNames.length > 0 ||
      replacedExercises.length > 0
  };
};

const formatExerciseNames = (exerciseNames: string[]): string => exerciseNames.map((name) => `“${name}”`).join('、');

export const buildPlanEditChangeSummaryMessage = (summary: PlanEditChangeSummary): string => {
  const messageParts: string[] = [];

  if (summary.titleChanged) {
    messageParts.push('已更新计划标题');
  }

  if (summary.durationChanged) {
    messageParts.push(`已调整总时长为 ${summary.nextDurationMinutes} 分钟`);
  }

  if (summary.replacedExercises.length > 0) {
    messageParts.push(
      `已替换动作：${summary.replacedExercises
        .map((item) => `“${item.previousName}” -> “${item.nextName}”`)
        .join('、')}`
    );
  }

  if (summary.addedExerciseNames.length > 0) {
    messageParts.push(`已添加动作：${formatExerciseNames(summary.addedExerciseNames)}`);
  }

  if (summary.removedExerciseNames.length > 0) {
    messageParts.push(`已删除动作：${formatExerciseNames(summary.removedExerciseNames)}`);
  }

  if (summary.reordered) {
    messageParts.push('已调整动作顺序');
  }

  if (messageParts.length === 0) {
    return '训练计划已更新';
  }

  return `训练计划已更新：${messageParts.join('；')}`;
};
