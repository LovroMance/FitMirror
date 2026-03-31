import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { fetchExercises } from '@/api/exercises';
import { filterExercises } from '@/utils/exercise-filter';
import type { ExerciseFilters, ExerciseItem } from '@/types/exercise';

const levelLabel = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶'
} as const;

const bodyPartLabel = {
  core: '核心',
  upper: '上肢',
  lower: '下肢',
  full_body: '全身',
  mobility: '灵活恢复'
} as const;

const equipmentLabel = {
  none: '无器械',
  mat: '瑜伽垫',
  dumbbell: '哑铃',
  band: '弹力带',
  chair: '椅子'
} as const;

export const useExerciseLibrary = () => {
  const router = useRouter();
  const route = useRoute();

  const loading = ref(false);
  const errorMessage = ref('');
  const exercises = ref<ExerciseItem[]>([]);
  const detailVisible = ref(false);
  const selectedExercise = ref<ExerciseItem | null>(null);

  const filters = reactive<ExerciseFilters>({
    keyword: '',
    bodyPart: 'all',
    level: 'all',
    equipment: 'all'
  });

  const filteredExercises = computed(() => filterExercises(exercises.value, filters));
  const detailInstructions = computed(() => {
    if (!selectedExercise.value || selectedExercise.value.instructions.length === 0) {
      return ['暂无动作要点'];
    }

    return selectedExercise.value.instructions;
  });

  const detailTips = computed(() => {
    if (!selectedExercise.value || selectedExercise.value.tips.length === 0) {
      return ['暂无注意事项'];
    }

    return selectedExercise.value.tips;
  });

  const openExercise = (item: ExerciseItem): void => {
    selectedExercise.value = item;
    detailVisible.value = true;
  };

  const resetFilters = (): void => {
    filters.keyword = '';
    filters.bodyPart = 'all';
    filters.level = 'all';
    filters.equipment = 'all';
  };

  const applyQueryKeyword = (): void => {
    const queryKeyword = typeof route.query.q === 'string' ? route.query.q.trim() : '';
    filters.keyword = queryKeyword;
  };

  const loadExercises = async (): Promise<void> => {
    loading.value = true;
    errorMessage.value = '';

    try {
      exercises.value = await fetchExercises();
    } catch {
      errorMessage.value = '动作库加载失败，请稍后重试。';
    } finally {
      loading.value = false;
    }
  };

  const backHome = async (): Promise<void> => {
    try {
      await router.push({ name: 'Home' });
    } catch {
      ElMessage.error('页面跳转失败，请稍后重试');
    }
  };

  watch(
    () => route.query.q,
    () => {
      applyQueryKeyword();
    }
  );

  onMounted(async () => {
    applyQueryKeyword();
    await loadExercises();
  });

  return {
    backHome,
    bodyPartLabel,
    detailInstructions,
    detailTips,
    detailVisible,
    equipmentLabel,
    errorMessage,
    filteredExercises,
    filters,
    levelLabel,
    loadExercises,
    loading,
    openExercise,
    resetFilters,
    selectedExercise
  };
};
