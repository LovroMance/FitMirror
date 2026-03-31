<template>
  <div class="workout-session">
    <main class="workout-session__screen">
      <header class="workout-session__header">
        <p class="workout-session__eyebrow">Workout Session</p>
        <h1 class="workout-session__title">开始本次训练</h1>
        <p class="workout-session__description">按当前计划依次完成动作，结束后会自动写入训练记录。</p>
      </header>

      <StatePanel
        v-if="sessionState === 'loading'"
        variant="loading"
        title="正在加载训练计划"
        description="稍等片刻，正在读取本地计划。"
      />
      <StatePanel
        v-else-if="sessionState === 'error'"
        variant="error"
        title="训练计划加载失败"
        :description="sessionError"
        action-label="返回计划页"
        @action="goBackToPlans"
      />
      <template v-else-if="plan">
        <el-card shadow="never" class="fm-card workout-session__card">
          <div class="workout-session__summary">
            <div>
              <h2 class="workout-session__plan-title">{{ plan.title }}</h2>
              <p class="workout-session__plan-meta">{{ plan.durationMinutes }} 分钟 · {{ plan.exercises.length }} 个动作</p>
            </div>
            <span class="workout-session__progress-chip">
              {{ completedExercises }}/{{ plan.exercises.length }}
            </span>
          </div>
          <p class="workout-session__summary-text">{{ plan.summary }}</p>
        </el-card>

        <el-card shadow="never" class="fm-card workout-session__card">
          <template v-if="!started">
            <div class="workout-session__intro">
              <h2>准备开始</h2>
              <p>点击开始后按顺序完成动作。训练完成会自动记录到热图。</p>
            </div>
            <ol class="workout-session__preview-list">
              <li
                v-for="(exercise, idx) in plan.exercises"
                :key="`${exercise.name}-${idx}`"
                class="workout-session__preview-item"
              >
                <span>#{{ idx + 1 }}</span>
                <strong>{{ exercise.name }}</strong>
                <small>{{ exercise.durationSeconds ? `${exercise.durationSeconds} 秒` : exercise.reps }}</small>
              </li>
            </ol>
            <div class="workout-session__actions">
              <el-button class="fm-button-primary workout-session__primary" @click="startSession">开始训练</el-button>
              <el-button text class="workout-session__secondary" @click="goBackToPlans">返回计划页</el-button>
            </div>
          </template>

          <template v-else-if="currentExercise">
            <div class="workout-session__current-head">
              <div>
                <p class="workout-session__step-label">当前动作</p>
                <h2 class="workout-session__exercise-title">{{ currentExercise.name }}</h2>
              </div>
              <span class="workout-session__step-index">第 {{ currentExerciseIndex + 1 }} / {{ plan.exercises.length }} 步</span>
            </div>

            <p class="workout-session__exercise-meta">
              {{ currentExercise.durationSeconds ? `${currentExercise.durationSeconds} 秒` : currentExercise.reps }} ·
              休息 {{ currentExercise.restSeconds }} 秒
            </p>
            <p class="workout-session__exercise-instruction">{{ currentExercise.instruction }}</p>

            <div class="workout-session__actions">
              <el-button
                class="fm-button-primary workout-session__primary"
                :loading="saving"
                :disabled="saving"
                @click="advanceSession"
              >
                {{ isLastExercise ? '完成训练' : '下一个动作' }}
              </el-button>
              <el-button text class="workout-session__secondary" :disabled="saving" @click="goBackToPlans">
                稍后继续
              </el-button>
            </div>
          </template>
        </el-card>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import StatePanel from '@/components/common/StatePanel.vue';
import { plansRepository, workoutRecordsRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth';
import type { TrainingPlan } from '@/types/plan';
import type { PageState } from '@/types/ui';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const sessionState = ref<PageState>('idle');
const sessionError = ref('当前训练计划不可用，请返回计划页重新生成。');
const plan = ref<TrainingPlan | null>(null);
const latestPlanId = ref<number | null>(null);
const started = ref(false);
const saving = ref(false);
const currentExerciseIndex = ref(0);
const sessionStartedAt = ref<number | null>(null);

const completedExercises = computed(() => (started.value ? currentExerciseIndex.value : 0));
const currentExercise = computed(() => {
  if (!plan.value) {
    return null;
  }

  return plan.value.exercises[currentExerciseIndex.value] ?? null;
});
const isLastExercise = computed(() => {
  if (!plan.value) {
    return false;
  }

  return currentExerciseIndex.value >= plan.value.exercises.length - 1;
});

const resolveUserId = (): number | null => {
  const userId = authStore.currentUser?.id ?? null;
  if (!userId) {
    ElMessage.error('登录状态失效，请重新登录');
    return null;
  }

  return userId;
};

const goBackToPlans = async (): Promise<void> => {
  if (latestPlanId.value) {
    await router.push({ name: 'PlanGenerator' });
    return;
  }

  await router.push({ name: 'Home' });
};

const resolvePlanId = (): number | null => {
  const raw = Array.isArray(route.query.planId) ? route.query.planId[0] : route.query.planId;
  const planId = Number(raw);
  return Number.isFinite(planId) && planId > 0 ? planId : null;
};

const loadSession = async (): Promise<void> => {
  const userId = resolveUserId();
  const planId = resolvePlanId();

  if (!userId || !planId) {
    sessionState.value = 'error';
    sessionError.value = '缺少可用的训练计划，请先返回计划页生成或恢复计划。';
    return;
  }

  sessionState.value = 'loading';

  try {
    const targetPlan = await plansRepository.getPlanById(userId, planId);
    if (!targetPlan) {
      throw new Error('训练计划不存在或已被删除');
    }

    plan.value = targetPlan.planJson;
    latestPlanId.value = targetPlan.id ?? planId;
    sessionState.value = 'ready';
    sessionError.value = '';
  } catch (error) {
    sessionState.value = 'error';
    sessionError.value = error instanceof Error ? error.message : '训练计划读取失败，请稍后重试。';
  }
};

const startSession = (): void => {
  if (!plan.value) {
    return;
  }

  started.value = true;
  currentExerciseIndex.value = 0;
  sessionStartedAt.value = Date.now();
};

const finishSession = async (): Promise<void> => {
  const userId = resolveUserId();
  if (!userId || !plan.value) {
    return;
  }

  saving.value = true;

  try {
    const measuredMinutes =
      sessionStartedAt.value !== null ? Math.round((Date.now() - sessionStartedAt.value) / 60000) : 0;
    const duration = measuredMinutes > 0 ? measuredMinutes : plan.value.durationMinutes;

    await workoutRecordsRepository.createRecord({
      userId,
      date: dayjs().format('YYYY-MM-DD'),
      duration,
      completed: true,
      ...(latestPlanId.value ? { planId: latestPlanId.value } : {})
    });

    ElMessage.success('训练已完成，记录已写入热图');
    await router.push({ name: 'WorkoutLog' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '训练记录写入失败，请稍后重试';
    ElMessage.error(message);
  } finally {
    saving.value = false;
  }
};

const advanceSession = async (): Promise<void> => {
  if (!plan.value || saving.value) {
    return;
  }

  if (isLastExercise.value) {
    await finishSession();
    return;
  }

  currentExerciseIndex.value += 1;
};

onMounted(async () => {
  await loadSession();
});
</script>

<style scoped>
.workout-session {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.workout-session__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 20px 104px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.workout-session__header,
.workout-session__summary,
.workout-session__current-head,
.workout-session__intro {
  display: grid;
  gap: 10px;
}

.workout-session__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.workout-session__title,
.workout-session__plan-title,
.workout-session__exercise-title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
}

.workout-session__title {
  font-size: 34px;
  line-height: 1.08;
}

.workout-session__description,
.workout-session__summary-text,
.workout-session__exercise-instruction,
.workout-session__intro p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.workout-session__card {
  display: grid;
  gap: 14px;
}

.workout-session__plan-title {
  font-size: 26px;
  line-height: 1.2;
}

.workout-session__plan-meta,
.workout-session__exercise-meta,
.workout-session__step-label {
  margin: 0;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
}

.workout-session__progress-chip,
.workout-session__step-index {
  justify-self: flex-start;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.14);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.workout-session__preview-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.workout-session__preview-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.workout-session__preview-item span,
.workout-session__preview-item small {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.workout-session__preview-item strong {
  font-size: 15px;
}

.workout-session__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workout-session__primary {
  width: 100%;
  min-height: 54px;
  border-radius: 18px;
}

.workout-session__secondary {
  align-self: flex-start;
  color: var(--color-text-secondary);
}

@media (max-width: 390px) {
  .workout-session__screen {
    padding: 16px 14px 96px;
  }

  .workout-session__title {
    font-size: 30px;
  }

  .workout-session__plan-title {
    font-size: 23px;
  }
}
</style>
