<template>
  <div class="exercises-view">
    <main class="exercises-view__screen">
      <header class="exercises-view__header">
        <p class="exercises-view__eyebrow">Exercise Library</p>
        <h1 class="exercises-view__title">动作库</h1>
        <p class="exercises-view__description">按目标快速找到适合你的动作组合。</p>
      </header>

      <el-card shadow="never" class="fm-card exercises-view__card">
        <el-input v-model="filters.keyword" placeholder="搜索动作、部位、标签" clearable class="fm-textarea" />

        <div class="exercises-view__filters">
          <el-select v-model="filters.bodyPart" size="large">
            <el-option label="全部部位" value="all" />
            <el-option label="核心" value="core" />
            <el-option label="上肢" value="upper" />
            <el-option label="下肢" value="lower" />
            <el-option label="全身" value="full_body" />
            <el-option label="灵活恢复" value="mobility" />
          </el-select>
          <el-select v-model="filters.level" size="large">
            <el-option label="全部难度" value="all" />
            <el-option label="入门" value="beginner" />
            <el-option label="进阶" value="intermediate" />
            <el-option label="高阶" value="advanced" />
          </el-select>
          <el-select v-model="filters.equipment" size="large">
            <el-option label="全部器械" value="all" />
            <el-option label="无器械" value="none" />
            <el-option label="瑜伽垫" value="mat" />
            <el-option label="哑铃" value="dumbbell" />
            <el-option label="弹力带" value="band" />
            <el-option label="椅子" value="chair" />
          </el-select>
        </div>

        <div class="exercises-view__filter-actions">
          <span>共 {{ filteredExercises.length }} 个动作</span>
          <el-button text @click="resetFilters">清空筛选</el-button>
        </div>
      </el-card>

      <el-card v-if="loading" shadow="never" class="fm-card exercises-view__card">
        <p class="exercises-view__empty">动作库加载中...</p>
      </el-card>

      <el-card v-else-if="errorMessage" shadow="never" class="fm-card exercises-view__card">
        <p class="exercises-view__error">{{ errorMessage }}</p>
        <el-button class="fm-button-primary exercises-view__retry" @click="loadExercises">重试加载</el-button>
      </el-card>

      <el-card v-else-if="filteredExercises.length === 0" shadow="never" class="fm-card exercises-view__card">
        <p class="exercises-view__empty">暂无匹配动作，试试调整筛选条件。</p>
      </el-card>

      <section v-else class="exercises-view__list">
        <el-card
          v-for="item in filteredExercises"
          :key="item.id"
          shadow="never"
          class="fm-card exercises-view__item"
          @click="openExercise(item)"
        >
          <div class="exercises-view__item-top">
            <h3>{{ item.name }}</h3>
            <span>{{ levelLabel[item.level] }}</span>
          </div>
          <p>{{ item.description }}</p>
          <div class="exercises-view__meta">
            <span>{{ bodyPartLabel[item.bodyPart] }}</span>
            <span>{{ equipmentLabel[item.equipment] }}</span>
            <span>{{ item.durationMinutes }} min</span>
          </div>
        </el-card>
      </section>

      <el-button text class="exercises-view__back" @click="router.push({ name: 'Home' })">返回首页</el-button>
    </main>

    <el-dialog v-model="detailVisible" title="动作详情" width="92%" align-center>
      <template v-if="selectedExercise">
        <h3 class="exercises-view__dialog-title">{{ selectedExercise.name }}</h3>
        <p class="exercises-view__dialog-meta">
          {{ bodyPartLabel[selectedExercise.bodyPart] }} · {{ levelLabel[selectedExercise.level] }} ·
          {{ equipmentLabel[selectedExercise.equipment] }}
        </p>
        <p class="exercises-view__dialog-desc">{{ selectedExercise.description || '暂无动作描述' }}</p>

        <h4>建议训练</h4>
        <p>
          {{ selectedExercise.sets }} 组 · {{ selectedExercise.reps || '按体能完成' }} ·
          {{ selectedExercise.durationMinutes }} 分钟
        </p>

        <h4>动作要点</h4>
        <ul>
          <li v-for="(line, idx) in detailInstructions" :key="`ins-${idx}`">{{ line }}</li>
        </ul>

        <h4>注意事项</h4>
        <ul>
          <li v-for="(line, idx) in detailTips" :key="`tip-${idx}`">{{ line }}</li>
        </ul>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchExercises } from '@/api/exercises';
import { filterExercises } from '@/utils/exercise-filter';
import type { ExerciseFilters, ExerciseItem } from '@/types/exercise';

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

const levelLabel = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶'
};

const bodyPartLabel = {
  core: '核心',
  upper: '上肢',
  lower: '下肢',
  full_body: '全身',
  mobility: '灵活恢复'
};

const equipmentLabel = {
  none: '无器械',
  mat: '瑜伽垫',
  dumbbell: '哑铃',
  band: '弹力带',
  chair: '椅子'
};

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
    errorMessage.value = '动作库加载失败，请稍后重试';
  } finally {
    loading.value = false;
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
</script>

<style scoped>
.exercises-view {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.exercises-view__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.exercises-view__header {
  display: grid;
  gap: 8px;
}

.exercises-view__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.exercises-view__title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 30px;
}

.exercises-view__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.exercises-view__filters {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.exercises-view__filter-actions {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.exercises-view__list {
  display: grid;
  gap: 10px;
}

.exercises-view__item {
  cursor: pointer;
}

.exercises-view__item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.exercises-view__item-top h3 {
  margin: 0;
  font-size: 16px;
}

.exercises-view__item-top span {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.exercises-view__item p {
  margin: 8px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.exercises-view__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.exercises-view__meta span {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.1);
  color: var(--color-primary);
  font-size: 11px;
}

.exercises-view__empty {
  color: var(--color-text-secondary);
}

.exercises-view__error {
  color: var(--color-danger);
  margin: 0;
}

.exercises-view__retry {
  margin-top: 12px;
  width: 100%;
}

.exercises-view__back {
  align-self: flex-start;
  color: var(--color-text-secondary);
}

.exercises-view__dialog-title {
  margin: 0;
}

.exercises-view__dialog-meta {
  color: var(--color-primary);
}

.exercises-view__dialog-desc {
  color: var(--color-text-secondary);
}
</style>
