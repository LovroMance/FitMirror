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
          </div>
          <p class="workout-session__summary-text">{{ plan.summary }}</p>
          <div class="workout-session__session-stats">
            <span class="workout-session__summary-pill">动作进度 {{ completedExercises }}/{{ plan.exercises.length }}</span>
            <span class="workout-session__summary-pill">总组数 {{ totalSets }}</span>
            <span class="workout-session__summary-pill">已完成 {{ completedSets }}</span>
          </div>
        </el-card>

        <el-card shadow="never" class="fm-card workout-session__card">
          <template v-if="!started">
            <div class="workout-session__intro">
              <h2>准备开始</h2>
              <p>先快速浏览整套动作，再逐个展开需要调整的项。点击开始后会按“组”推进，训练完成会自动记录到热图。</p>
            </div>
            <ol class="workout-session__preview-list">
              <li
                v-for="(exercise, idx) in sessionExercises"
                :key="`${exercise.name}-${idx}`"
                class="workout-session__preview-item"
                :class="{ 'is-active': activeConfigIndex === idx }"
              >
                <button type="button" class="workout-session__preview-toggle" @click="toggleConfigCard(idx)">
                  <div class="workout-session__preview-top">
                    <span>#{{ idx + 1 }}</span>
                    <strong>{{ exercise.name }}</strong>
                    <small>{{ formatExerciseVolume(exercise) }}</small>
                  </div>
                  <span class="workout-session__toggle-copy">
                    {{ activeConfigIndex === idx ? '收起' : '编辑' }}
                  </span>
                </button>
                <p v-if="activeConfigIndex === idx">{{ exercise.instruction }}</p>
                <div v-if="activeConfigIndex === idx" class="workout-session__draft-grid">
                  <label class="workout-session__draft-field">
                    <span>组数</span>
                    <el-input-number
                      :model-value="exercise.setCount"
                      :min="1"
                      :max="12"
                      controls-position="right"
                      @update:model-value="(value) => updateExerciseDraftValue(idx, 'setCount', Number(value))"
                    />
                  </label>
                  <label v-if="exercise.mode === 'reps'" class="workout-session__draft-field">
                    <span>每组次数</span>
                    <el-input-number
                      :model-value="exercise.repsPerSet"
                      :min="1"
                      :max="50"
                      controls-position="right"
                      @update:model-value="(value) => updateExerciseDraftValue(idx, 'repsPerSet', Number(value))"
                    />
                  </label>
                  <label v-else class="workout-session__draft-field">
                    <span>每组时长(秒)</span>
                    <el-input-number
                      :model-value="exercise.durationSeconds"
                      :min="5"
                      :max="300"
                      controls-position="right"
                      @update:model-value="(value) => updateExerciseDraftValue(idx, 'durationSeconds', Number(value))"
                    />
                  </label>
                </div>
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

            <div class="workout-session__focus-panel">
              <div class="workout-session__focus-main">
                <strong>{{ currentSetLabel }}</strong>
                <p>{{ currentExerciseVolumeLabel }}</p>
              </div>
              <div class="workout-session__focus-side">
                <span>组间休息</span>
                <strong>{{ currentExercise.restSeconds }} 秒</strong>
              </div>
            </div>

            <div class="workout-session__set-track" aria-label="组数进度">
              <span
                v-for="setIndex in currentExercise.setCount"
                :key="`${currentExercise.name}-set-${setIndex}`"
                class="workout-session__set-dot"
                :class="{ 'is-completed': setIndex <= currentExercise.completedSets }"
              ></span>
            </div>

            <p class="workout-session__exercise-instruction">{{ currentExercise.instruction }}</p>

            <div class="workout-session__actions">
              <el-button
                class="fm-button-primary workout-session__primary"
                :loading="saving"
                :disabled="saving"
                @click="advanceSession"
              >
                {{ primaryActionLabel }}
              </el-button>
            </div>
          </template>
        </el-card>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import StatePanel from '@/components/common/StatePanel.vue';
import { useWorkoutSession } from '@/composables/workout/useWorkoutSession';

const activeConfigIndex = ref<number | null>(0);

const toggleConfigCard = (index: number): void => {
  activeConfigIndex.value = activeConfigIndex.value === index ? null : index;
};

const {
  advanceSession,
  completedExercises,
  completedSets,
  currentExercise,
  currentExerciseIndex,
  currentExerciseVolumeLabel,
  currentSetLabel,
  formatExerciseVolume,
  goBackToPlans,
  plan,
  primaryActionLabel,
  saving,
  sessionExercises,
  sessionError,
  sessionState,
  startSession,
  started,
  totalSets,
  updateExerciseDraftValue
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

.workout-session__session-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.workout-session__summary-pill {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
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
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.workout-session__preview-item.is-active {
  border-color: rgba(50, 213, 131, 0.16);
  background: rgba(50, 213, 131, 0.05);
}

.workout-session__preview-toggle {
  display: grid;
  gap: 10px;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.workout-session__preview-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.workout-session__toggle-copy {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
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

.workout-session__preview-item p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.workout-session__draft-grid,
.workout-session__live-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.workout-session__draft-field {
  display: grid;
  gap: 8px;
}

.workout-session__draft-field span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.workout-session__focus-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(50, 213, 131, 0.12), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(50, 213, 131, 0.12);
}

.workout-session__focus-main,
.workout-session__focus-side {
  display: grid;
  gap: 4px;
}

.workout-session__focus-main strong,
.workout-session__focus-side strong {
  font-size: 18px;
  line-height: 1.2;
}

.workout-session__focus-main p,
.workout-session__focus-side span {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.workout-session__focus-side {
  justify-items: end;
}

.workout-session__set-track {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workout-session__set-dot {
  width: 28px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.workout-session__set-dot.is-completed {
  background: var(--color-primary);
  box-shadow: 0 0 18px rgba(50, 213, 131, 0.28);
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

  .workout-session__session-stats,
  .workout-session__draft-grid,
  .workout-session__live-grid {
    grid-template-columns: 1fr;
  }

  .workout-session__focus-panel {
    grid-template-columns: 1fr;
  }

  .workout-session__focus-side {
    justify-items: start;
  }
}
</style>
