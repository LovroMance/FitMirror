<template>
  <div class="workout-log">
    <main class="workout-log__screen">
      <header class="workout-log__header">
        <p class="workout-log__eyebrow">Workout Log</p>
        <h1 class="workout-log__title">训练记录热图</h1>
        <p class="workout-log__description">查看最近六周训练活跃度，并可点击日期查看详细记录。</p>
      </header>

      <el-card shadow="never" class="fm-card workout-log__card">
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
        <div class="workout-log__card-head">
          <div>
            <h2>训练热图</h2>
            <p>{{ dateRangeLabel }} · 点击方格查看当天详情</p>
          </div>
          <div class="workout-log__legend">
            <span class="workout-log__legend-cell workout-log__legend-cell--0"></span>
            <span class="workout-log__legend-cell workout-log__legend-cell--1"></span>
            <span class="workout-log__legend-cell workout-log__legend-cell--2"></span>
            <span class="workout-log__legend-cell workout-log__legend-cell--3"></span>
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
          description="先完成一次真实训练，或在下方手动补录一条记录。"
          action-label="去开始训练"
          @action="router.push({ name: 'PlanGenerator' })"
        />
        <div v-else class="workout-log__heatmap" role="grid" aria-label="训练热图">
          <div v-for="(row, rowIndex) in heatmapRows" :key="`row-${rowIndex}`" class="workout-log__heatmap-row">
            <button
              v-for="point in row"
              :key="point.date"
              type="button"
              class="workout-log__cell"
              :class="`workout-log__cell--level-${point.intensityLevel}`"
              :title="`${point.date} · ${point.count} 次 · ${point.totalDuration} 分钟`"
              @click="openDayDetail(point.date)"
            >
              <span class="sr-only">{{ point.date }}</span>
            </button>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="fm-card workout-log__card">
        <div class="workout-log__card-head">
          <h2>手动补录</h2>
          <p>真实训练完成会自动写入热图；这里保留手动补录作为补记和调试入口。</p>
        </div>
        <div class="workout-log__actions">
          <el-button class="fm-button-primary" :loading="isMockWriting" :disabled="isMockWriting" @click="mockAddRecord(10)">
            补录 10 分钟
          </el-button>
          <el-button class="fm-button-primary" :loading="isMockWriting" :disabled="isMockWriting" @click="mockAddRecord(20)">
            补录 20 分钟
          </el-button>
          <el-button class="fm-button-primary" :loading="isMockWriting" :disabled="isMockWriting" @click="mockAddRecord(30)">
            补录 30 分钟
          </el-button>
        </div>
      </el-card>

      <el-button text class="workout-log__back" @click="router.push({ name: 'Home' })">返回首页</el-button>
    </main>

    <el-dialog v-model="detailVisible" title="当日训练详情" width="92%" align-center>
      <template v-if="selectedDate">
        <p class="workout-log__detail-date">{{ selectedDate }}</p>
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
              :key="`${detail.id ?? detail.date}-${detail.duration}`"
              class="workout-log__detail-item"
            >
              <span>{{ detail.completed ? '已完成' : '未完成' }}</span>
              <strong>{{ detail.duration }} 分钟</strong>
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
import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import StatePanel from '@/components/common/StatePanel.vue';
import { useAuthStore } from '@/store/auth';
import { workoutRecordsRepository } from '@/repositories';
import type { WorkoutRecordEntity } from '@/types/local-db';
import type { PageState } from '@/types/ui';
import type { DailyHeatmapPoint } from '@/types/workout';
import {
  buildDailyHeatmapPoints,
  buildHeatmapRows,
  calculateWorkoutSummary,
  getRecentDateRange
} from '@/utils/workout-heatmap';

const router = useRouter();
const authStore = useAuthStore();

const records = ref<WorkoutRecordEntity[]>([]);
const dailyPoints = ref<DailyHeatmapPoint[]>([]);
const detailVisible = ref(false);
const selectedDate = ref('');
const dayDetails = ref<WorkoutRecordEntity[]>([]);
const detailLoading = ref(false);
const detailError = ref('');
const detailCacheByDate = ref<Record<string, WorkoutRecordEntity[]>>({});
const isMockWriting = ref(false);
const lastMockWriteAt = ref(0);
const detailRequestToken = ref(0);
const recordsState = ref<PageState>('idle');
const recordsError = ref('暂时无法读取训练记录，请稍后重试。');
const MOCK_WRITE_GAP_MS = 900;

const summary = computed(() => calculateWorkoutSummary(dailyPoints.value));
const heatmapRows = computed(() => buildHeatmapRows(dailyPoints.value));
const dateRangeLabel = computed(() => {
  if (dailyPoints.value.length === 0) {
    const { dates } = getRecentDateRange(42);
    const start = dayjs(dates[0]).format('MM.DD');
    const end = dayjs(dates[dates.length - 1]).format('MM.DD');
    return `${start}-${end}`;
  }

  const start = dayjs(dailyPoints.value[0].date).format('MM.DD');
  const end = dayjs(dailyPoints.value[dailyPoints.value.length - 1].date).format('MM.DD');
  return `${start}-${end}`;
});

const resolveUserId = (): number | null => {
  const userId = authStore.currentUser?.id ?? null;
  if (!userId) {
    ElMessage.error('登录状态失效，请重新登录');
    return null;
  }

  return userId;
};

const refreshRecords = async (): Promise<void> => {
  const userId = resolveUserId();
  if (!userId) {
    return;
  }

  if (dailyPoints.value.length === 0) {
    recordsState.value = 'loading';
  }

  try {
    const { startDate, endDate, dates } = getRecentDateRange(42);
    const loaded = await workoutRecordsRepository.listRecordsByDateRange(userId, startDate, endDate);
    records.value = loaded;
    dailyPoints.value = buildDailyHeatmapPoints(loaded, dates);
    recordsState.value = summary.value.trainingDays > 0 ? 'ready' : 'empty';
    recordsError.value = '';
  } catch {
    if (dailyPoints.value.length > 0) {
      recordsState.value = 'ready';
      ElMessage.warning('刷新失败，已保留上次可用记录');
      return;
    }

    recordsState.value = 'error';
    recordsError.value = '暂时无法读取训练记录，请稍后重试。';
    ElMessage.error('读取训练记录失败，请稍后重试');
  }
};

const mockAddRecord = async (duration: number): Promise<void> => {
  if (!Number.isFinite(duration) || duration <= 0) {
    ElMessage.warning('训练时长异常，请稍后重试');
    return;
  }

  const now = Date.now();
  if (isMockWriting.value || now - lastMockWriteAt.value < MOCK_WRITE_GAP_MS) {
    ElMessage.warning('请稍后再试，避免重复写入');
    return;
  }

  const userId = resolveUserId();
  if (!userId) {
    return;
  }

  isMockWriting.value = true;

  try {
    await workoutRecordsRepository.createRecord({
      userId,
      date: dayjs().format('YYYY-MM-DD'),
      duration,
      completed: true
    });

    await refreshRecords();
    lastMockWriteAt.value = Date.now();
    ElMessage.success(`已写入 ${duration} 分钟训练记录`);
  } catch {
    ElMessage.error('写入训练记录失败，请稍后重试');
  } finally {
    isMockWriting.value = false;
  }
};

const openDayDetail = async (date: string): Promise<void> => {
  if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
    ElMessage.warning('日期数据异常，请刷新后重试');
    return;
  }

  const userId = resolveUserId();
  if (!userId) {
    return;
  }

  selectedDate.value = date;
  detailVisible.value = true;
  detailLoading.value = true;
  detailError.value = '';

  const requestToken = detailRequestToken.value + 1;
  detailRequestToken.value = requestToken;

  const cached = detailCacheByDate.value[date];
  if (cached) {
    dayDetails.value = cached;
  }

  try {
    const details = await workoutRecordsRepository.listRecordsByDay(userId, date);
    if (requestToken !== detailRequestToken.value) {
      return;
    }

    dayDetails.value = details;
    detailCacheByDate.value[date] = details;
    detailError.value = '';
  } catch {
    if (requestToken !== detailRequestToken.value) {
      return;
    }

    detailError.value = '请检查本地数据状态后重试。';
    if (!cached) {
      dayDetails.value = [];
    }
    ElMessage.error('读取当天详情失败，请稍后重试');
  } finally {
    if (requestToken === detailRequestToken.value) {
      detailLoading.value = false;
    }
  }
};

const retryDayDetail = async (): Promise<void> => {
  if (!selectedDate.value) {
    return;
  }

  await openDayDetail(selectedDate.value);
};

onMounted(async () => {
  await refreshRecords();
});
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
  gap: 18px;
  padding: 20px 20px 104px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.workout-log__header {
  display: grid;
  gap: 10px;
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
  line-height: 1.6;
}

.workout-log__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.workout-log__metric-label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
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

.workout-log__legend {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
}

.workout-log__legend-cell {
  width: 14px;
  height: 14px;
  border-radius: 4px;
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
  background: #6ee7a8;
}

.workout-log__heatmap {
  margin-top: 14px;
  display: grid;
  gap: 7px;
}

.workout-log__heatmap-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
}

.workout-log__cell {
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  background: #16161a;
  transition:
    transform var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease;
}

.workout-log__cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.24);
}

.workout-log__cell--level-1 {
  background: #244436;
}

.workout-log__cell--level-2 {
  background: #24c06f;
}

.workout-log__cell--level-3 {
  background: #32d583;
}

.workout-log__cell--level-4 {
  background: #6ee7a8;
}

.workout-log__actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.workout-log__back {
  align-self: flex-start;
  color: var(--color-text-secondary);
}

.workout-log__detail-date {
  margin: 0;
  color: var(--color-text-secondary);
}

.workout-log__detail-list {
  margin: 12px 0 14px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.workout-log__detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: rgba(21, 24, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.05);
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
    padding: 16px 14px 96px;
  }

  .workout-log__summary-grid {
    gap: 8px;
  }

  .workout-log__metric-value {
    font-size: 18px;
  }

  .workout-log__heatmap-row {
    gap: 6px;
  }

  .workout-log__cell {
    border-radius: 7px;
  }

  .workout-log__actions {
    grid-template-columns: 1fr;
  }

  .workout-log__title {
    font-size: 30px;
  }

  .workout-log__card-head h2 {
    font-size: 20px;
  }
}
</style>
