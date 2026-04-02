import { computed, ref } from 'vue';
import type { EditableTrainingPlanDraft, PlanExercise, TrainingPlan } from '@/types/plan';

const cloneTrainingPlan = (plan: TrainingPlan): TrainingPlan => JSON.parse(JSON.stringify(plan)) as TrainingPlan;

const cloneEditablePlanDraft = (draft: EditableTrainingPlanDraft): EditableTrainingPlanDraft =>
  JSON.parse(JSON.stringify(draft)) as EditableTrainingPlanDraft;

const createEditablePlanDraft = (plan: TrainingPlan): EditableTrainingPlanDraft => ({
  title: plan.title,
  level: plan.level,
  durationMinutes: plan.durationMinutes,
  summary: plan.summary,
  exercises: plan.exercises.map((exercise) => ({ ...exercise }))
});

const isValidPlanExercise = (value: unknown): value is PlanExercise => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Partial<PlanExercise>;
  return (
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    typeof item.instruction === 'string' &&
    item.instruction.trim().length > 0 &&
    (typeof item.reps === 'string' || typeof item.durationSeconds === 'number') &&
    typeof item.restSeconds === 'number' &&
    Number.isFinite(item.restSeconds)
  );
};

const isValidTrainingPlan = (value: unknown): value is TrainingPlan => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<TrainingPlan>;
  return (
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.durationMinutes === 'number' &&
    Number.isFinite(candidate.durationMinutes) &&
    candidate.durationMinutes > 0 &&
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.exercises) &&
    candidate.exercises.length > 0 &&
    candidate.exercises.every((exercise) => isValidPlanExercise(exercise))
  );
};

interface UseEditablePlanDraftOptions {
  notifyWarning: (message: string) => void;
}

export const useEditablePlanDraft = ({ notifyWarning }: UseEditablePlanDraftOptions) => {
  const isEditingPlan = ref(false);
  const editablePlanDraft = ref<EditableTrainingPlanDraft | null>(null);
  const originalEditablePlanDraft = ref<EditableTrainingPlanDraft | null>(null);

  const hasUnsavedEditingPlanChanges = computed(() => {
    if (!isEditingPlan.value || !editablePlanDraft.value || !originalEditablePlanDraft.value) {
      return false;
    }

    return JSON.stringify(editablePlanDraft.value) !== JSON.stringify(originalEditablePlanDraft.value);
  });

  const clearEditingPlanDraft = (): void => {
    isEditingPlan.value = false;
    editablePlanDraft.value = null;
    originalEditablePlanDraft.value = null;
  };

  const startEditingPlan = (plan: TrainingPlan): void => {
    const nextDraft = createEditablePlanDraft(plan);
    editablePlanDraft.value = nextDraft;
    originalEditablePlanDraft.value = cloneEditablePlanDraft(nextDraft);
    isEditingPlan.value = true;
  };

  const restoreEditingPlanDraft = (draft: EditableTrainingPlanDraft): void => {
    const nextDraft = cloneEditablePlanDraft(draft);
    editablePlanDraft.value = nextDraft;
    originalEditablePlanDraft.value = cloneEditablePlanDraft(nextDraft);
    isEditingPlan.value = true;
  };

  const syncEditingPlanDraftAsSaved = (): void => {
    if (!editablePlanDraft.value) {
      originalEditablePlanDraft.value = null;
      return;
    }

    originalEditablePlanDraft.value = cloneEditablePlanDraft(editablePlanDraft.value);
  };

  const cancelEditingPlan = (): void => {
    if (!isEditingPlan.value) {
      return;
    }

    clearEditingPlanDraft();
  };

  const updateEditingPlanTitle = (value: string): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    editablePlanDraft.value.title = value;
  };

  const updateEditingPlanDuration = (value: number | null | undefined): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    editablePlanDraft.value.durationMinutes = typeof value === 'number' ? value : 0;
  };

  const moveEditingPlanExercise = (fromIndex: number, toIndex: number): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    const exercises = editablePlanDraft.value.exercises;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= exercises.length ||
      toIndex >= exercises.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const reorderedExercises = [...exercises];
    const [targetExercise] = reorderedExercises.splice(fromIndex, 1);
    reorderedExercises.splice(toIndex, 0, targetExercise);
    editablePlanDraft.value.exercises = reorderedExercises;
  };

  const moveEditingPlanExerciseUp = (exerciseIndex: number): void => {
    moveEditingPlanExercise(exerciseIndex, exerciseIndex - 1);
  };

  const moveEditingPlanExerciseDown = (exerciseIndex: number): void => {
    moveEditingPlanExercise(exerciseIndex, exerciseIndex + 1);
  };

  const removeEditingPlanExercise = (exerciseIndex: number): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    if (editablePlanDraft.value.exercises.length <= 1) {
      notifyWarning('训练计划至少需要保留 1 个动作');
      return;
    }

    editablePlanDraft.value.exercises = editablePlanDraft.value.exercises.filter(
      (_exercise, currentIndex) => currentIndex !== exerciseIndex
    );
  };

  const replaceEditingPlanExercise = (exerciseIndex: number, replacementExercise: PlanExercise): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    if (exerciseIndex < 0 || exerciseIndex >= editablePlanDraft.value.exercises.length) {
      notifyWarning('待替换的动作位置无效，请返回计划页重试');
      return;
    }

    editablePlanDraft.value.exercises = editablePlanDraft.value.exercises.map((exercise, currentIndex) =>
      currentIndex === exerciseIndex ? { ...replacementExercise } : exercise
    );
  };

  const appendEditingPlanExercise = (nextExercise: PlanExercise): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    editablePlanDraft.value.exercises = [...editablePlanDraft.value.exercises, { ...nextExercise }];
  };

  const buildValidatedEditingPlan = (): TrainingPlan | null => {
    if (!editablePlanDraft.value) {
      notifyWarning('当前没有可保存的编辑内容');
      return null;
    }

    const normalizedTitle = editablePlanDraft.value.title.trim();
    if (!normalizedTitle) {
      notifyWarning('请输入训练计划标题');
      return null;
    }

    if (!Number.isInteger(editablePlanDraft.value.durationMinutes) || editablePlanDraft.value.durationMinutes <= 0) {
      notifyWarning('总时长需为正整数分钟');
      return null;
    }

    if (editablePlanDraft.value.exercises.length === 0) {
      notifyWarning('训练计划至少需要保留 1 个动作');
      return null;
    }

    const validatedPlan: TrainingPlan = {
      ...cloneTrainingPlan(editablePlanDraft.value),
      title: normalizedTitle
    };

    if (!isValidTrainingPlan(validatedPlan)) {
      notifyWarning('训练计划数据异常，请检查后重试');
      return null;
    }

    return validatedPlan;
  };

  return {
    buildValidatedEditingPlan,
    cancelEditingPlan,
    clearEditingPlanDraft,
    editablePlanDraft,
    appendEditingPlanExercise,
    hasUnsavedEditingPlanChanges,
    isEditingPlan,
    moveEditingPlanExerciseDown,
    moveEditingPlanExerciseUp,
    removeEditingPlanExercise,
    replaceEditingPlanExercise,
    restoreEditingPlanDraft,
    syncEditingPlanDraftAsSaved,
    startEditingPlan,
    updateEditingPlanDuration,
    updateEditingPlanTitle
  };
};

