<template>
  <div class="plan-generator">
    <main class="plan-generator__screen">
      <header class="plan-generator__header">
        <p class="plan-generator__eyebrow">AI Plan</p>
        <h1 class="plan-generator__title">生成今日训练计划</h1>
        <p class="plan-generator__description">输入目标后即可获得可执行的训练建议，并自动保存最近一次结果。</p>
      </header>

      <el-card shadow="never" class="fm-card plan-generator__card">
        <el-input
          v-model="goalText"
          type="textarea"
          :rows="4"
          resize="none"
          class="fm-textarea"
          placeholder="例如：我想瘦肚子，每天10分钟，无器械"
        />

        <div class="plan-generator__actions">
          <el-button
            type="primary"
            size="large"
            class="fm-button-primary plan-generator__submit"
            :loading="loading"
            :disabled="loading || deleting"
            @click="handleGenerate"
          >
            {{ loading ? '生成中...' : '生成计划' }}
          </el-button>
          <el-button text class="plan-generator__back" @click="router.push({ name: 'Home' })">返回首页</el-button>
        </div>

        <div class="plan-generator__status-wrap">
          <StatePanel
            v-if="loading"
            variant="loading"
            :title="progressLabel"
            description="保持当前页面，生成完成后会自动保存最近一次计划。"
          />
          <StatePanel
            v-if="errorMessage"
            variant="error"
            title="生成失败"
            :description="errorMessage"
            :action-label="goalText.trim() ? '重试生成' : ''"
            @action="handleGenerate"
          />
        </div>
      </el-card>

      <el-card v-if="plan" shadow="never" class="fm-card plan-generator__card">
        <div class="plan-generator__plan-head">
          <h2 class="plan-generator__plan-title">{{ plan.title }}</h2>
          <div class="plan-generator__plan-meta-row">
            <p class="plan-generator__plan-meta">{{ levelText }} · {{ plan.durationMinutes }} 分钟</p>
            <span class="plan-generator__source-tag" :class="`plan-generator__source-tag--${sourceTagClass}`">
              {{ sourceLabel }}
            </span>
          </div>
          <p class="plan-generator__plan-summary">{{ plan.summary }}</p>
          <div class="plan-generator__plan-actions">
            <el-button text class="plan-generator__library-link" @click="openExerciseLibrary()">浏览动作库</el-button>
            <el-button
              text
              type="danger"
              class="plan-generator__delete"
              :loading="deleting"
              :disabled="loading || deleting"
              @click="handleDeleteLatest"
            >
              {{ deleting ? '删除中...' : '删除最近计划' }}
            </el-button>
          </div>
        </div>

        <ul class="plan-generator__exercise-list">
          <li v-for="(exercise, idx) in plan.exercises" :key="exercise.name" class="plan-generator__exercise-item">
            <div class="plan-generator__exercise-top">
              <span class="plan-generator__exercise-index">#{{ idx + 1 }}</span>
              <button type="button" class="plan-generator__exercise-link" @click="openExerciseLibrary(exercise.name)">
                {{ exercise.name }}
              </button>
              <span>{{ exercise.durationSeconds ? `${exercise.durationSeconds} 秒` : exercise.reps }}</span>
            </div>
            <p>{{ exercise.instruction }}</p>
            <small>休息 {{ exercise.restSeconds }} 秒</small>
          </li>
        </ul>
      </el-card>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { generatePlanApiWithSource, generatePlanStream } from '@/api/plans';
import { useAuthStore } from '@/store/auth';
import StatePanel from '@/components/common/StatePanel.vue';
import type { PlanExercise, PlanSource, PlanStreamEvent, TrainingPlan } from '@/types/plan';
import { plansRepository } from '@/repositories';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const goalText = ref('');
const loading = ref(false);
const deleting = ref(false);
const errorMessage = ref('');
const plan = ref<TrainingPlan | null>(null);
const latestPlanId = ref<number | null>(null);
const planSource = ref<PlanSource | null>(null);
const progressState = ref<PlanStreamEvent['type'] | null>(null);
const generationRound = ref(0);

const currentUserId = computed(() => authStore.currentUser?.id ?? null);
const levelText = computed(() => {
  if (!plan.value) {
    return '未知难度';
  }

  if (plan.value.level === 'beginner') {
    return '入门级';
  }

  if (plan.value.level === 'intermediate') {
    return '进阶级';
  }

  return '未知难度';
});

const progressLabel = computed(() => {
  switch (progressState.value) {
    case 'queued':
      return '准备中...';
    case 'llm_start':
      return 'AI 生成中...';
    case 'llm_done':
      return '结果校验中...';
    case 'llm_failed':
      return 'AI 生成失败，正在切换模板...';
    case 'fallback_start':
      return '模板回退中...';
    case 'completed':
      return '已完成';
    default:
      return '生成中...';
  }
});

const sourceLabel = computed(() => {
  if (planSource.value === 'deepseek') {
    return 'AI 生成';
  }

  if (planSource.value === 'template') {
    return '模板回退';
  }

  return '本地恢复';
});

const sourceTagClass = computed(() => {
  if (planSource.value === 'deepseek') {
    return 'ai';
  }

  if (planSource.value === 'template') {
    return 'fallback';
  }

  return 'restored';
});

const isValidExercise = (value: unknown): value is PlanExercise => {
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

const isValidPlan = (value: unknown): value is TrainingPlan => {
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
    candidate.exercises.every((exercise) => isValidExercise(exercise))
  );
};

const resolveCurrentUserId = (): number | null => {
  const userId = currentUserId.value;
  if (!userId) {
    ElMessage.error('登录状态已失效，请重新登录');
    return null;
  }

  return userId;
};

const openExerciseLibrary = (keyword = ''): void => {
  const query = keyword ? { q: keyword } : {};
  router.push({ name: 'Exercises', query });
};

const handleGenerate = async (): Promise<void> => {
  if (loading.value || deleting.value) {
    return;
  }

  const userId = resolveCurrentUserId();
  if (!userId) {
    return;
  }

  const trimmedGoal = goalText.value.trim();
  if (!trimmedGoal) {
    ElMessage.warning('请先输入训练目标');
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  progressState.value = 'queued';
  const currentRound = generationRound.value + 1;
  generationRound.value = currentRound;

  try {
    const streamed = await generatePlanStream(
      trimmedGoal,
      (event) => {
        if (currentRound !== generationRound.value) {
          return;
        }

        progressState.value = event.type;
      },
      { timeoutMs: 12000 }
    );

    if (currentRound !== generationRound.value) {
      return;
    }

    if (!isValidPlan(streamed.plan)) {
      throw new Error('计划数据异常，请重试');
    }

    plan.value = streamed.plan;
    planSource.value = streamed.source ?? null;
  } catch {
    try {
      const fallback = await generatePlanApiWithSource(trimmedGoal);
      if (currentRound !== generationRound.value) {
        return;
      }

      if (!isValidPlan(fallback.plan)) {
        throw new Error('计划数据异常，请重试');
      }

      plan.value = fallback.plan;
      planSource.value = fallback.source ?? 'template';
      progressState.value = 'completed';
      ElMessage.warning('已自动切换到稳定生成通道');
    } catch (error) {
      if (currentRound !== generationRound.value) {
        return;
      }

      const message = error instanceof Error ? error.message : '计划生成失败，请稍后重试';
      errorMessage.value = message;
      ElMessage.error(message);
      loading.value = false;
      return;
    }
  }

  try {
    if (!plan.value) {
      throw new Error('计划生成失败，请稍后重试');
    }

    const persistedPlan = JSON.parse(JSON.stringify(plan.value)) as TrainingPlan;

    const saved = await plansRepository.saveLatestPlan({
      userId,
      goalText: trimmedGoal,
      plan: persistedPlan
    });

    if (currentRound !== generationRound.value) {
      return;
    }

    latestPlanId.value = saved.id ?? null;
    progressState.value = 'completed';
    ElMessage.success('计划已生成并保存');
  } catch (error) {
    if (currentRound !== generationRound.value) {
      return;
    }

    const message = error instanceof Error ? error.message : '计划保存失败，请稍后重试';
    errorMessage.value = message;
    ElMessage.error(message);
  } finally {
    if (currentRound === generationRound.value) {
      loading.value = false;
    }
  }
};

const handleDeleteLatest = async (): Promise<void> => {
  if (loading.value || deleting.value) {
    return;
  }

  const userId = resolveCurrentUserId();
  if (!userId) {
    return;
  }

  deleting.value = true;
  errorMessage.value = '';

  try {
    await plansRepository.deletePlan(userId, latestPlanId.value ?? undefined);
    latestPlanId.value = null;
    plan.value = null;
    planSource.value = null;
    ElMessage.success('最近计划已删除');
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败，请稍后重试';
    errorMessage.value = message;
    ElMessage.error(message);
  } finally {
    deleting.value = false;
  }
};

const restoreLatestPlan = async (): Promise<void> => {
  const userId = resolveCurrentUserId();
  if (!userId) {
    return;
  }

  try {
    const latest = await plansRepository.loadLatestPlan(userId);
    if (!latest) {
      return;
    }

    if (!isValidPlan(latest.planJson)) {
      errorMessage.value = '最近计划数据异常，已忽略旧数据';
      plan.value = null;
      latestPlanId.value = null;
      planSource.value = null;
      ElMessage.warning('最近计划数据异常，请重新生成');
      return;
    }

    latestPlanId.value = latest.id ?? null;
    if (!goalText.value) {
      goalText.value = latest.goalText;
    }
    plan.value = latest.planJson;
    planSource.value = null;
  } catch {
    errorMessage.value = '读取本地计划失败，但你仍可继续生成新计划';
    ElMessage.warning('读取本地计划失败，但不影响继续使用');
  }
};

onMounted(async () => {
  const goalFromQuery = typeof route.query.goal === 'string' ? route.query.goal.trim() : '';
  if (goalFromQuery) {
    goalText.value = goalFromQuery;
  }

  await restoreLatestPlan();
});
</script>

<style scoped>
.plan-generator {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.plan-generator__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 20px 110px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.plan-generator__header {
  display: grid;
  gap: 10px;
}

.plan-generator__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.plan-generator__title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 34px;
  line-height: 1.08;
}

.plan-generator__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.plan-generator__actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.plan-generator__submit {
  flex: 1;
  height: 56px;
  border-radius: 18px;
}

.plan-generator__back {
  color: var(--color-text-secondary);
}

.plan-generator__status-wrap {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.plan-generator__plan-head {
  display: grid;
  gap: 10px;
}

.plan-generator__plan-title {
  margin: 0;
  font-size: 27px;
  line-height: 1.2;
  font-weight: 600;
}

.plan-generator__plan-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.plan-generator__plan-meta {
  margin: 0;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.11);
}

.plan-generator__source-tag {
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 5px 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.plan-generator__source-tag--ai {
  color: #0c2f1d;
  background: rgba(50, 213, 131, 0.9);
}

.plan-generator__source-tag--fallback {
  color: #f5c451;
  background: rgba(245, 196, 81, 0.16);
}

.plan-generator__source-tag--restored {
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.1);
}

.plan-generator__plan-summary {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.65;
}

.plan-generator__plan-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plan-generator__library-link {
  color: var(--color-primary);
  padding-left: 0;
}

.plan-generator__delete {
  padding-right: 0;
}

.plan-generator__exercise-list {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.plan-generator__exercise-item {
  padding: 14px 14px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(22, 26, 24, 0.92), rgba(14, 17, 16, 0.92));
}

.plan-generator__exercise-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plan-generator__exercise-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.16);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.plan-generator__exercise-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  flex: 1;
  text-align: left;
  line-height: 1.35;
}

.plan-generator__exercise-link:hover {
  color: var(--color-primary);
}

.plan-generator__exercise-top span {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.plan-generator__exercise-item p {
  margin: 10px 0 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.plan-generator__exercise-item small {
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 390px) {
  .plan-generator__screen {
    padding: 16px 14px 106px;
  }

  .plan-generator__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .plan-generator__back {
    align-self: flex-start;
  }

  .plan-generator__plan-actions {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  .plan-generator__title {
    font-size: 30px;
  }

  .plan-generator__plan-title {
    font-size: 23px;
  }

  .plan-generator__exercise-item {
    padding: 12px;
  }
}
</style>


