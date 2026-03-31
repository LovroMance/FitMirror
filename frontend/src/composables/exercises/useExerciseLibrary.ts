import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { fetchExercises } from '@/api/exercises';
import { exercisePreferencesRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth';
import { filterExercises } from '@/utils/exercise-filter';
import type { ExerciseFilters, ExerciseItem, ExerciseLibraryItemView } from '@/types/exercise';
import type { ExercisePreferenceEntity } from '@/types/local-db';

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
  const authStore = useAuthStore();

  const loading = ref(false);
  const errorMessage = ref('');
  const exercises = ref<ExerciseItem[]>([]);
  const preferences = ref<ExercisePreferenceEntity[]>([]);
  const detailVisible = ref(false);
  const selectedExercise = ref<ExerciseLibraryItemView | null>(null);

  const filters = reactive<ExerciseFilters>({
    keyword: '',
    bodyPart: 'all',
    level: 'all',
    equipment: 'all'
  });

  const resolveUserId = (): number | null => {
    const userId = authStore.currentUser?.id ?? null;
    if (!userId) {
      ElMessage.error('登录状态失效，请重新登录');
      return null;
    }

    return userId;
  };

  const exerciseViews = computed<ExerciseLibraryItemView[]>(() => {
    const preferenceMap = new Map(preferences.value.map((item) => [item.exerciseId, item]));

    return exercises.value.map((item) => {
      const preference = preferenceMap.get(item.id);
      return {
        ...item,
        isFavorite: preference?.isFavorite ?? false,
        lastViewedAt: preference?.lastViewedAt ?? null
      };
    });
  });

  const filteredExercises = computed(() => filterExercises(exerciseViews.value, filters));
  const favoriteExercises = computed(() =>
    exerciseViews.value
      .filter((item) => item.isFavorite)
      .sort((a, b) => {
        const updatedA = preferences.value.find((entry) => entry.exerciseId === a.id)?.updatedAt ?? '';
        const updatedB = preferences.value.find((entry) => entry.exerciseId === b.id)?.updatedAt ?? '';
        return updatedB.localeCompare(updatedA);
      })
  );
  const recentViewedExercises = computed(() =>
    exerciseViews.value
      .filter((item) => Boolean(item.lastViewedAt))
      .sort((a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''))
      .slice(0, 10)
  );
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

  const syncSelectedExercise = (): void => {
    if (!selectedExercise.value) {
      return;
    }

    selectedExercise.value = exerciseViews.value.find((item) => item.id === selectedExercise.value?.id) ?? null;
  };

  const loadPreferences = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    preferences.value = await exercisePreferencesRepository.listPreferencesByUser(userId);
  };

  const openExercise = async (item: ExerciseLibraryItemView): Promise<void> => {
    selectedExercise.value = item;
    detailVisible.value = true;

    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    try {
      await exercisePreferencesRepository.touchRecentlyViewed(userId, item.id);
      await loadPreferences();
      syncSelectedExercise();
    } catch {
      ElMessage.warning('最近查看写入失败，但不影响继续浏览');
    }
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
      await loadPreferences();
      syncSelectedExercise();
    } catch {
      errorMessage.value = '动作库加载失败，请稍后重试。';
    } finally {
      loading.value = false;
    }
  };

  const toggleFavorite = async (item: ExerciseLibraryItemView): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    try {
      await exercisePreferencesRepository.toggleFavorite(userId, item.id);
      await loadPreferences();
      syncSelectedExercise();
      ElMessage.success(item.isFavorite ? '已取消收藏' : '已加入收藏');
    } catch {
      ElMessage.error('收藏状态更新失败，请稍后重试');
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
    favoriteExercises,
    filteredExercises,
    filters,
    levelLabel,
    loadExercises,
    loading,
    openExercise,
    recentViewedExercises,
    resetFilters,
    selectedExercise,
    toggleFavorite
  };
};
