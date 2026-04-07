<template>
  <div class="workout-log">
    <main class="workout-log__screen">
      <header class="workout-log__header">
        <div class="workout-log__header-top">
          <el-button text class="workout-log__top-back" @click="goHome">返回</el-button>
        </div>
        <p class="workout-log__eyebrow">Workout Log</p>
        <h1 class="workout-log__title">训练记录热图</h1>
        <p class="workout-log__description">按自然月查看训练活跃度，并可点击日期查看详细记录。</p>
      </header>

      <el-card shadow="never" class="fm-card workout-log__card">
        <div v-if="completionBanner.visible" class="workout-log__completion-banner">
          <div class="workout-log__completion-copy">
            <p class="workout-log__completion-eyebrow">{{ completionBanner.title }}</p>
            <p class="workout-log__completion-description">{{ completionBanner.description }}</p>
          </div>
          <el-button class="workout-log__completion-action" @click="handleCompletionBannerAction">
            {{ completionBanner.actionLabel }}
          </el-button>
        </div>
        <div v-if="completionBanner.visible" class="workout-log__completion-divider"></div>
        <div class="workout-log__summary-grid">
          <div>
            <p class="workout-log__metric-label">训练天数</p>
            <p class="workout-log__metric-value">{{ summary.trainingDays }}</p>
          </div>
          <div>
            <p class="workout-log__metric-label">总时长</p>
            <p class="workout-log__metric-value">{{ summary.totalDuration }} min</p>
          </div>
          <div>
            <p class="workout-log__metric-label">连续打卡</p>
            <p class="workout-log__metric-value">{{ summary.streakDays }} 天</p>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="fm-card workout-log__card">
        <div class="workout-log__trend-grid">
          <div class="workout-log__trend-item">
            <p class="workout-log__metric-label workout-log__metric-label--stacked">
              <span>{{ periodTitle }}</span>
              <span>训练天数</span>
            </p>
            <p class="workout-log__metric-value">{{ trendSummary.trainingDays }}</p>
          </div>
          <div class="workout-log__trend-item">
            <p class="workout-log__metric-label workout-log__metric-label--stacked">
              <span>{{ periodTitle }}</span>
              <span>总时长</span>
            </p>
            <p class="workout-log__metric-value">{{ trendSummary.totalDuration }} min</p>
          </div>
          <div class="workout-log__trend-item">
            <p class="workout-log__metric-label workout-log__metric-label--stacked">
              <span>平均</span>
              <span>单次时长</span>
            </p>
            <p class="workout-log__metric-value">{{ trendSummary.averageDuration }} min</p>
          </div>
        </div>
        <p class="workout-log__trend-note">
          最活跃训练日：{{ trendSummary.busiestDate || '当前周期暂无训练记录' }}
        </p>
      </el-card>

      <el-card shadow="never" class="fm-card workout-log__card">
        <div class="workout-log__card-head workout-log__card-head--filters">
          <div>
            <h2>筛选与检索</h2>
            <p>按日期、时长、完成状态或训练标题快速回看记录。</p>
          </div>
          <el-button text class="workout-log__reset-link" @click="clearRecordFilters">清空筛选</el-button>
        </div>

        <div class="workout-log__filters">
          <el-input
            v-model="searchKeyword"
            clearable
            class="workout-log__search"
            placeholder="搜索训练标题、目标或日期"
          />
          <el-date-picker
            v-model="selectedFilterDateRange"
            type="daterange"
            unlink-panels
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            range-separator="至"
            value-format="YYYY-MM-DD"
            class="workout-log__date-range"
          />
          <div class="workout-log__filter-group">
            <span class="workout-log__filter-label">完成状态</span>
            <div class="workout-log__chip-row">
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedCompletionFilter === 'all' }"
                @click="setCompletionFilter('all')"
              >
                全部
              </button>
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedCompletionFilter === 'completed' }"
                @click="setCompletionFilter('completed')"
              >
                已完成
              </button>
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedCompletionFilter === 'incomplete' }"
                @click="setCompletionFilter('incomplete')"
              >
                未完成
              </button>
            </div>
          </div>
          <div class="workout-log__filter-group">
            <span class="workout-log__filter-label">时长</span>
            <div class="workout-log__chip-row">
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedDurationFilter === 'all' }"
                @click="setDurationFilter('all')"
              >
                全部
              </button>
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedDurationFilter === 'short' }"
                @click="setDurationFilter('short')"
              >
                15 分钟内
              </button>
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedDurationFilter === 'medium' }"
                @click="setDurationFilter('medium')"
              >
                16-30 分钟
              </button>
              <button
                type="button"
                class="workout-log__chip"
                :class="{ 'is-active': selectedDurationFilter === 'long' }"
                @click="setDurationFilter('long')"
              >
                31 分钟以上
              </button>
            </div>
          </div>
        </div>

        <div class="workout-log__filter-summary">
          <span>匹配 {{ filteredRecordsSummary.count }} 条</span>
          <strong>{{ filteredRecordsSummary.totalDuration }} 分钟</strong>
        </div>

        <div v-if="filteredRecordItems.length > 0" class="workout-log__record-list">
          <article v-for="record in filteredRecordItems" :key="record.clientRecordId" class="workout-log__record-item">
            <div class="workout-log__record-copy">
              <div class="workout-log__record-top">
                <strong>{{ record.title }}</strong>
                <span :class="record.completed ? 'is-completed' : 'is-incomplete'">
                  {{ record.completed ? '已完成' : '未完成' }}
                </span>
              </div>
              <p>{{ record.subtitle }}</p>
              <div class="workout-log__record-meta">
                <span>{{ record.date }}</span>
                <span>{{ record.duration }} min</span>
                <span>{{ record.sourceLabel }}</span>
              </div>
            </div>
            <el-button text class="workout-log__record-action" @click="openDayDetail(record.date)">查看当天</el-button>
          </article>
        </div>
        <p v-else class="workout-log__empty">当前筛选条件下没有匹配记录</p>
      </el-card>

      <el-card shadow="never" class="fm-card workout-log__card">
        <div class="workout-log__card-head">
          <div>
            <h2>训练热图</h2>
            <p>{{ dateRangeLabel }} · 点击方格查看当天详情</p>
          </div>
          <div class="workout-log__head-actions">
            <div class="workout-log__month-nav" aria-label="热图月份翻页">
              <button type="button" class="workout-log__month-button" @click="goToPreviousMonth">上月</button>
              <span class="workout-log__month-label">{{ periodTitle }}</span>
              <button
                type="button"
                class="workout-log__month-button"
                :disabled="!canNavigateToNextMonth"
                @click="goToNextMonth"
              >
                下月
              </button>
            </div>
            <div class="workout-log__legend">
              <span class="workout-log__legend-cell workout-log__legend-cell--0"></span>
              <span class="workout-log__legend-cell workout-log__legend-cell--1"></span>
              <span class="workout-log__legend-cell workout-log__legend-cell--2"></span>
              <span class="workout-log__legend-cell workout-log__legend-cell--3"></span>
              <span class="workout-log__legend-cell workout-log__legend-cell--4"></span>
            </div>
          </div>
        </div>

        <StatePanel
          v-if="recordsState === 'loading'"
          variant="loading"
          title="正在加载训练热图"
          description="稍等片刻，正在同步最近训练记录。"
        />
        <StatePanel
          v-else-if="recordsState === 'error'"
          variant="error"
          title="热图加载失败"
          :description="recordsError"
          action-label="重新加载"
          @action="refreshRecords"
        />
        <StatePanel
          v-else-if="recordsState === 'empty'"
          variant="empty"
          title="还没有训练记录"
          description="先完成一次真实训练，热图就会自动亮起来。"
          action-label="去开始训练"
          @action="goToPlanGenerator"
        />
        <WorkoutCalendarHeatmap
          v-else
          :points="heatmapPoints"
          :month-start="selectedMonthStart"
          @select-date="openDayDetail"
        />
      </el-card>

    </main>

    <PrimaryTabBar />

    <el-dialog v-model="detailVisible" title="当日训练详情" width="92%" align-center>
      <template v-if="selectedDate">
        <p class="workout-log__detail-date">{{ selectedDate }}</p>
        <p v-if="completedDateTarget === selectedDate" class="workout-log__detail-focus">
          已为你标出刚完成训练对应的记录卡片
        </p>
        <StatePanel
          v-if="detailLoading"
          variant="loading"
          title="正在读取当天详情"
          description="请稍候，我们正在同步该日期的记录。"
        />
        <StatePanel
          v-else-if="detailError"
          variant="error"
          title="当天详情读取失败"
          :description="detailError"
          action-label="重试"
          @action="retryDayDetail"
        />
        <template v-else-if="dayDetails.length > 0">
          <ul class="workout-log__detail-list">
            <li
              v-for="detail in dayDetails"
              :key="detail.clientRecordId"
              class="workout-log__detail-item"
              :class="{ 'is-just-completed': detail.isJustCompleted }"
            >
              <div class="workout-log__detail-copy">
                <div class="workout-log__detail-top">
                  <span>{{ detail.isJustCompleted ? '刚完成' : detail.completed ? '已完成' : '未完成' }}</span>
                  <strong>{{ detail.duration }} 分钟</strong>
                </div>
                <p v-if="detail.isJustCompleted" class="workout-log__detail-badge">本次训练结果</p>
                <p class="workout-log__detail-source">来源：{{ detail.sourceLabel }}</p>
                <template v-if="detail.canViewPlan">
                  <p class="workout-log__detail-plan">{{ getWorkoutDayDetailPlanLabel(detail) }}</p>
                  <p class="workout-log__detail-goal">{{ getWorkoutDayDetailHint(detail) }}</p>
                  <el-button text class="workout-log__detail-link" @click="openRelatedPlan(detail.planId)">
                    查看对应计划
                  </el-button>
                </template>
                <p v-else class="workout-log__detail-missing">{{ getWorkoutDayDetailHint(detail) }}</p>
                <template v-if="editingRecordId === detail.clientRecordId">
                  <div class="workout-log__detail-edit-form">
                    <label class="workout-log__detail-field">
                      <span>训练时长（分钟）</span>
                      <el-input-number v-model="editingDuration" :min="1" :max="300" :step="1" controls-position="right" />
                    </label>
                    <label class="workout-log__detail-checkbox">
                      <el-checkbox v-model="editingCompleted">标记为已完成</el-checkbox>
                    </label>
                    <div class="workout-log__detail-actions">
                      <el-button text :disabled="detailSaving" @click="cancelEditingRecord">取消</el-button>
                      <el-button class="fm-button-primary" :loading="detailSaving" @click="saveEditedRecord">保存</el-button>
                    </div>
                  </div>
                </template>
                <div v-else class="workout-log__detail-actions">
                  <el-button text :disabled="detailSaving" @click="startEditingRecord(detail)">编辑</el-button>
                  <el-button text type="danger" :disabled="detailSaving" @click="deleteRecord(detail)">删除</el-button>
                </div>
              </div>
            </li>
          </ul>
          <p class="workout-log__detail-total">
            共 {{ dayDetails.length }} 次 · {{ dayDetails.reduce((sum, item) => sum + item.duration, 0) }} 分钟
          </p>
        </template>
        <p v-else class="workout-log__empty">当天暂无训练记录</p>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import StatePanel from '@/components/common/StatePanel.vue';
import PrimaryTabBar from '@/components/layout/PrimaryTabBar.vue';
import { useWorkoutLog } from '@/composables/workout/useWorkoutLog';
import { getWorkoutDayDetailHint, getWorkoutDayDetailPlanLabel } from '@/utils/workout-day-detail-copy';

const {
  dateRangeLabel,
  completionBanner,
  completedDateTarget,
  deleteRecord,
  dayDetails,
  detailError,
  detailLoading,
  detailSaving,
  detailVisible,
  editingCompleted,
  editingDuration,
  editingRecordId,
  cancelEditingRecord,
  clearRecordFilters,
  filteredRecordItems,
  filteredRecordsSummary,
  goHome,
  goToPlanGenerator,
  heatmapPoints,
  handleCompletionBannerAction,
  openDayDetail,
  openRelatedPlan,
  periodTitle,
  recordsError,
  recordsState,
  refreshRecords,
  retryDayDetail,
  saveEditedRecord,
  searchKeyword,
  selectedCompletionFilter,
  selectedDurationFilter,
  selectedFilterDateRange,
  selectedMonthStart,
  canNavigateToNextMonth,
  selectedDate,
  setCompletionFilter,
  setDurationFilter,
  summary,
  startEditingRecord,
  trendSummary,
  goToPreviousMonth,
  goToNextMonth
} = useWorkoutLog();
</script>

<style scoped>
.workout-log {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.workout-log__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 20px 104px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.workout-log__header {
  display: grid;
  gap: 12px;
}

.workout-log__header-top {
  display: flex;
  align-items: center;
}

.workout-log__top-back {
  padding-left: 0;
  color: var(--color-text-secondary);
}

.workout-log__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.workout-log__title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 34px;
  line-height: 1.08;
}

.workout-log__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.72;
}

.workout-log__card {
  border-radius: 14px;
}

.workout-log__card :deep(.el-card__body) {
  display: grid;
  gap: 18px;
  padding-top: 8px;
}

.workout-log__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.workout-log__completion-banner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.workout-log__completion-copy {
  display: grid;
  gap: 6px;
}

.workout-log__completion-eyebrow {
  margin: 0;
  color: #8ff0bc;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.workout-log__completion-description {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.55;
}

.workout-log__completion-action {
  justify-self: end;
}

.workout-log__completion-divider {
  height: 1px;
  margin: 14px 0 2px;
  background: linear-gradient(90deg, rgba(50, 213, 131, 0.48), rgba(255, 255, 255, 0.04));
}

.workout-log__metric-label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 11px;
  letter-spacing: 0.05em;
  line-height: 1.5;
  text-transform: uppercase;
}

.workout-log__metric-label--stacked {
  display: grid;
  gap: 2px;
}

.workout-log__metric-value {
  margin: 8px 0 0;
  color: var(--color-primary);
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.workout-log__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.workout-log__card-head--filters {
  align-items: center;
}

.workout-log__card-head h2 {
  margin: 0;
  font-size: 22px;
  font-family: 'Fraunces', 'Times New Roman', serif;
}

.workout-log__card-head p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.workout-log__head-actions {
  display: grid;
  gap: 12px;
  justify-items: end;
}

.workout-log__reset-link {
  align-self: flex-start;
  padding-right: 0;
}

.workout-log__filters {
  display: grid;
  gap: 14px;
}

.workout-log__search,
.workout-log__date-range {
  width: 100%;
}

.workout-log__filter-group {
  display: grid;
  gap: 8px;
}

.workout-log__filter-label {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workout-log__chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workout-log__chip {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.workout-log__chip.is-active {
  border-color: rgba(50, 213, 131, 0.26);
  background: rgba(50, 213, 131, 0.14);
  color: var(--color-primary);
}

.workout-log__filter-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.workout-log__filter-summary strong {
  color: var(--color-primary);
  font-size: 14px;
}

.workout-log__record-list {
  display: grid;
  gap: 10px;
}

.workout-log__record-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.workout-log__record-copy {
  display: grid;
  gap: 8px;
}

.workout-log__record-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.workout-log__record-top strong {
  font-size: 16px;
  line-height: 1.45;
}

.workout-log__record-top span {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
}

.workout-log__record-top span.is-completed {
  background: rgba(50, 213, 131, 0.14);
  color: var(--color-primary);
}

.workout-log__record-top span.is-incomplete {
  background: rgba(245, 196, 81, 0.14);
  color: var(--color-warning);
}

.workout-log__record-copy p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.workout-log__record-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.workout-log__record-action {
  align-self: center;
}

.workout-log__month-nav {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.workout-log__month-button {
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 8px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.workout-log__month-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.workout-log__month-label {
  min-width: 88px;
  align-self: center;
  text-align: center;
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 700;
}

.workout-log__trend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
}

.workout-log__trend-item {
  padding: 2px 0;
}

.workout-log__trend-item:not(:first-child) {
  padding-left: 14px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.workout-log__trend-note {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.workout-log__legend {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
}

.workout-log__legend-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.workout-log__legend-cell--0 {
  background: #16161a;
}

.workout-log__legend-cell--1 {
  background: #244436;
}

.workout-log__legend-cell--2 {
  background: #24c06f;
}

.workout-log__legend-cell--3 {
  background: #32d583;
}

.workout-log__legend-cell--4 {
  background: #6ee7a8;
}



.workout-log__detail-date {
  margin: 0;
  color: var(--color-text-secondary);
}

.workout-log__detail-focus {
  margin: 8px 0 0;
  color: #8ff0bc;
  font-size: 12px;
  line-height: 1.45;
}

.workout-log__detail-list {
  margin: 12px 0 14px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.workout-log__detail-item {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(21, 24, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.workout-log__detail-item.is-just-completed {
  background: linear-gradient(180deg, rgba(50, 213, 131, 0.16), rgba(21, 24, 28, 0.92));
  border-color: rgba(50, 213, 131, 0.5);
  box-shadow: 0 10px 24px rgba(6, 14, 9, 0.3);
}

.workout-log__detail-copy {
  display: grid;
  gap: 6px;
}

.workout-log__detail-edit-form {
  margin-top: 8px;
  display: grid;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.workout-log__detail-field {
  display: grid;
  gap: 6px;
}

.workout-log__detail-field span {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.workout-log__detail-checkbox {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.workout-log__detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workout-log__detail-source,
.workout-log__detail-goal,
.workout-log__detail-missing {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.workout-log__detail-plan {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.workout-log__detail-link {
  justify-self: flex-start;
  padding-left: 0;
  padding-right: 0;
}

.workout-log__detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.workout-log__detail-badge {
  width: fit-content;
  margin: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(143, 240, 188, 0.14);
  color: #b8ffd7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.workout-log__detail-total {
  margin: 0;
  color: var(--color-primary);
  font-weight: 600;
}

.workout-log__empty {
  color: var(--color-text-secondary);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 390px) {
  .workout-log__screen {
    padding: 18px 14px 96px;
  }

  .workout-log__summary-grid {
    gap: 8px;
  }

  .workout-log__completion-banner {
    grid-template-columns: 1fr;
  }

  .workout-log__completion-action {
    justify-self: stretch;
  }

  .workout-log__trend-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .workout-log__trend-item:not(:first-child) {
    padding-left: 0;
    padding-top: 12px;
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .workout-log__metric-value {
    font-size: 18px;
  }

  .workout-log__title {
    font-size: 30px;
  }

  .workout-log__card-head h2 {
    font-size: 20px;
  }

  .workout-log__card-head--filters,
  .workout-log__filter-summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .workout-log__record-item {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .workout-log__head-actions {
    width: 100%;
    justify-items: stretch;
  }

  .workout-log__month-nav {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
