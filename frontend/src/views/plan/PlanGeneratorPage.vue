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
            :disabled="loading || deleting || savingEdits"
            @click="handleGenerate"
          >
            {{ loading ? '生成中...' : '生成计划' }}
          </el-button>
          <el-button text class="plan-generator__history-link" @click="goToPlanHistory">查看历史计划</el-button>
          <el-button text class="plan-generator__back" @click="goHome">返回首页</el-button>
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
          <div class="plan-generator__plan-head-copy">
            <div class="plan-generator__plan-meta-row">
              <p class="plan-generator__plan-meta">{{ levelText }} · {{ activeDurationMinutes }} 分钟</p>
              <span class="plan-generator__source-tag" :class="`plan-generator__source-tag--${sourceTagClass}`">
                {{ sourceLabel }}
              </span>
            </div>
            <h2 class="plan-generator__plan-title">
              {{ isEditingPlan && editablePlanDraft ? editablePlanDraft.title : plan.title }}
            </h2>
          </div>

          <div v-if="!isEditingPlan" class="plan-generator__plan-actions">
            <el-button text class="plan-generator__library-link" @click="openExerciseLibrary()">浏览动作库</el-button>
            <el-button
              text
              class="plan-generator__edit-link"
              :disabled="loading || deleting || savingEdits"
              @click="enterEditMode"
            >
              编辑计划
            </el-button>
            <el-button
              class="fm-button-primary plan-generator__start"
              :disabled="loading || deleting || savingEdits || !latestPlanId"
              @click="startWorkout"
            >
              开始训练
            </el-button>
            <el-button
              text
              type="danger"
              class="plan-generator__delete"
              :loading="deleting"
              :disabled="loading || deleting || savingEdits"
              @click="handleDeleteLatest"
            >
              {{ deleting ? '删除中...' : '删除最近计划' }}
            </el-button>
          </div>

          <div v-else class="plan-generator__edit-actions">
            <el-button text class="plan-generator__secondary-link" :disabled="savingEdits" @click="cancelEdit">
              取消编辑
            </el-button>
            <el-button class="fm-button-primary plan-generator__save" :loading="savingEdits" @click="saveEditedPlan">
              {{ savingEdits ? '保存中...' : '保存编辑' }}
            </el-button>
          </div>
        </div>

        <p class="plan-generator__plan-summary">{{ plan.summary }}</p>

        <section v-if="!isEditingPlan && hasLastSavedPlanEditSummary" class="plan-generator__edit-summary">
          <div class="plan-generator__edit-summary-head">
            <h3>最近一次编辑结果</h3>
            <p>保存后会保留在这里，方便你再次确认刚刚改了什么。</p>
          </div>
          <ul class="plan-generator__edit-summary-list">
            <li v-for="highlight in latestSavedPlanEditSummaryHighlights" :key="highlight">{{ highlight }}</li>
          </ul>
        </section>

        <template v-if="isEditingPlan && editablePlanDraft">
          <div class="plan-generator__edit-form">
            <label class="plan-generator__field">
              <span class="plan-generator__field-label">计划标题</span>
              <el-input
                :model-value="editablePlanDraft.title"
                maxlength="40"
                placeholder="例如：10分钟核心激活训练"
                @update:model-value="updateDraftTitle"
              />
            </label>
            <label class="plan-generator__field">
              <span class="plan-generator__field-label">总时长（分钟）</span>
              <el-input-number
                :model-value="editablePlanDraft.durationMinutes"
                :min="1"
                :max="180"
                :step="1"
                controls-position="right"
                class="plan-generator__duration-input"
                @update:model-value="updateDraftDuration"
              />
            </label>
          </div>

          <div class="plan-generator__edit-tip">
            当前版本支持改标题、总时长、动作顺序、替换动作、添加动作和删除动作；动作选择会从动作库回填到当前草稿。
          </div>

          <ul class="plan-generator__exercise-list">
            <li
              v-for="(exercise, idx) in editablePlanDraft.exercises"
              :key="`${exercise.name}-${idx}`"
              class="plan-generator__exercise-item"
            >
              <div class="plan-generator__exercise-top">
                <span class="plan-generator__exercise-index">#{{ idx + 1 }}</span>
                <button type="button" class="plan-generator__exercise-link" @click="openExerciseLibrary(exercise.name)">
                  {{ exercise.name }}
                </button>
                <span>{{ exercise.durationSeconds ? `${exercise.durationSeconds} 秒` : exercise.reps }}</span>
              </div>
              <p>{{ exercise.instruction }}</p>
              <small>休息 {{ exercise.restSeconds }} 秒</small>
              <div class="plan-generator__exercise-actions">
                <el-button text :disabled="idx === 0 || savingEdits" @click="moveExerciseUp(idx)">上移</el-button>
                <el-button
                  text
                  :disabled="idx === editablePlanDraft.exercises.length - 1 || savingEdits"
                  @click="moveExerciseDown(idx)"
                >
                  下移
                </el-button>
                <el-button text :disabled="savingEdits" @click="startExerciseReplacement(idx)">替换动作</el-button>
                <el-button text type="danger" :disabled="savingEdits" @click="removeExercise(idx)">删除</el-button>
              </div>
            </li>
          </ul>

          <div class="plan-generator__append-action">
            <el-button class="fm-button-primary plan-generator__append-button" :disabled="savingEdits" @click="startAppendingExerciseToPlan">
              添加动作
            </el-button>
          </div>
        </template>

        <ul v-else class="plan-generator__exercise-list">
          <li v-for="(exercise, idx) in plan.exercises" :key="`${exercise.name}-${idx}`" class="plan-generator__exercise-item">
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
import { computed } from 'vue';
import StatePanel from '@/components/common/StatePanel.vue';
import { usePlanGenerator } from '@/composables/plan/usePlanGenerator';

const {
  cancelEdit,
  deleting,
  editablePlanDraft,
  enterEditMode,
  errorMessage,
  goalText,
  goHome,
  goToPlanHistory,
  handleDeleteLatest,
  handleGenerate,
  hasLastSavedPlanEditSummary,
  isEditingPlan,
  latestPlanId,
  latestSavedPlanEditSummaryHighlights,
  levelText,
  loading,
  moveExerciseDown,
  moveExerciseUp,
  openExerciseLibrary,
  plan,
  progressLabel,
  removeExercise,
  saveEditedPlan,
  savingEdits,
  sourceLabel,
  sourceTagClass,
  startAppendingExerciseToPlan,
  startExerciseReplacement,
  startWorkout,
  updateDraftDuration,
  updateDraftTitle
} = usePlanGenerator();

const activeDurationMinutes = computed(() => editablePlanDraft.value?.durationMinutes ?? plan.value?.durationMinutes ?? 0);
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

.plan-generator__history-link {
  color: var(--color-primary);
}

.plan-generator__status-wrap {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.plan-generator__plan-head {
  display: grid;
  gap: 12px;
}

.plan-generator__plan-head-copy {
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

.plan-generator__source-tag--edited {
  color: #b8ffd7;
  background: rgba(50, 213, 131, 0.16);
}

.plan-generator__plan-summary {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.65;
}

.plan-generator__plan-actions,
.plan-generator__edit-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-generator__start,
.plan-generator__save,
.plan-generator__append-button {
  min-height: 42px;
  border-radius: 14px;
}

.plan-generator__library-link,
.plan-generator__edit-link,
.plan-generator__secondary-link {
  color: var(--color-primary);
  padding-left: 0;
}

.plan-generator__delete {
  padding-right: 0;
}

.plan-generator__edit-form {
  display: grid;
  gap: 12px;
}

.plan-generator__field {
  display: grid;
  gap: 8px;
}

.plan-generator__field-label {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.plan-generator__duration-input {
  width: 100%;
}

.plan-generator__edit-tip {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(50, 213, 131, 0.08);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.plan-generator__edit-summary {
  margin-top: 18px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(50, 213, 131, 0.18);
  background: rgba(50, 213, 131, 0.08);
}

.plan-generator__edit-summary-head h3 {
  margin: 0;
  font-size: 18px;
}

.plan-generator__edit-summary-head p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.plan-generator__edit-summary-list {
  margin: 12px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.55;
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

.plan-generator__exercise-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.plan-generator__append-action {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

@media (max-width: 390px) {
  .plan-generator__screen {
    padding: 16px 14px 106px;
  }

  .plan-generator__actions,
  .plan-generator__plan-actions,
  .plan-generator__edit-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .plan-generator__back,
  .plan-generator__history-link,
  .plan-generator__library-link,
  .plan-generator__edit-link,
  .plan-generator__secondary-link {
    align-self: flex-start;
  }

  .plan-generator__append-action {
    justify-content: stretch;
  }

  .plan-generator__append-button {
    width: 100%;
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
