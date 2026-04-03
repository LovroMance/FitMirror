<template>
  <div class="workout-session">
    <main class="workout-session__screen">
      <header class="workout-session__header">
        <div class="workout-session__header-top">
          <el-button text class="workout-session__top-back" @click="goBackToPlans">返回</el-button>
        </div>
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
            </div>
          </template>
        </el-card>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import StatePanel from '@/components/common/StatePanel.vue';
import { useWorkoutSession } from '@/composables/workout/useWorkoutSession';

const {
  advanceSession,
  completedExercises,
  currentExercise,
  currentExerciseIndex,
  goBackToPlans,
  isLastExercise,
  plan,
  saving,
  sessionError,
  sessionState,
  startSession,
  started
} = useWorkoutSession();
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

.workout-session__header-top {
  display: flex;
  align-items: center;
}

.workout-session__top-back {
  padding-left: 0;
  color: var(--color-text-secondary);
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
