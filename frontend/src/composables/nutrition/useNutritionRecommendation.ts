import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { recommendNutritionApi } from '@/api/nutrition';
import type { PageState } from '@/types/ui';
import type {
  NutritionGoal,
  NutritionPreference,
  NutritionRecommendationResult,
  RecommendNutritionPayload
} from '@/types/nutrition';

export interface NutritionGoalOption {
  value: NutritionGoal;
  label: string;
  description: string;
}

export interface NutritionPreferenceOption {
  value: NutritionPreference;
  label: string;
}

const GOAL_OPTIONS: NutritionGoalOption[] = [
  { value: 'fat_loss', label: '减脂', description: '优先控制总热量，保证蛋白质和饱腹感。' },
  { value: 'muscle_gain', label: '增肌', description: '强调热量和蛋白质充足，帮助训练恢复。' },
  { value: 'maintenance', label: '保持', description: '保持饮食稳定和长期可执行性。' }
];

const PREFERENCE_OPTIONS: NutritionPreferenceOption[] = [
  { value: 'high_protein', label: '高蛋白' },
  { value: 'low_oil', label: '少油' },
  { value: 'light', label: '清淡' },
  { value: 'quick', label: '快手省时' }
];

export const useNutritionRecommendation = () => {
  const goal = ref<NutritionGoal>('fat_loss');
  const preferences = ref<NutritionPreference[]>([]);
  const avoidances = ref('');
  const pageState = ref<PageState>('idle');
  const submitting = ref(false);
  const errorMessage = ref('');
  const result = ref<NutritionRecommendationResult | null>(null);

  const canSubmit = computed(() => !submitting.value);
  const hasResult = computed(() => Boolean(result.value));

  const buildPayload = (): RecommendNutritionPayload => ({
    goal: goal.value,
    preferences: [...preferences.value],
    avoidances: avoidances.value.trim()
  });

  const submitRecommendation = async (): Promise<void> => {
    if (!canSubmit.value) {
      return;
    }

    submitting.value = true;
    pageState.value = 'loading';
    errorMessage.value = '';

    try {
      const nextResult = await recommendNutritionApi(buildPayload());
      result.value = nextResult;
      pageState.value = 'ready';
      ElMessage.success('饮食建议已生成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '饮食建议生成失败，请稍后重试';
      errorMessage.value = message;
      pageState.value = result.value ? 'ready' : 'error';
      ElMessage.error(message);
    } finally {
      submitting.value = false;
    }
  };

  return {
    avoidances,
    canSubmit,
    errorMessage,
    goal,
    goalOptions: GOAL_OPTIONS,
    hasResult,
    pageState,
    preferenceOptions: PREFERENCE_OPTIONS,
    preferences,
    result,
    submitRecommendation,
    submitting
  };
};
