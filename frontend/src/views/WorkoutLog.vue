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
          <h2>本月热图</h2>
          <p>点击方格查看当天详情</p>
        </div>

        <div class="workout-log__heatmap" role="grid" aria-label="训练热图">
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
          <h2>模拟写入</h2>
          <p>Day5 先用模拟入口写训练记录，后续接真实训练流程。</p>
        </div>
        <div class="workout-log__actions">
          <el-button class="fm-button-primary" :loading="isMockWriting" :disabled="isMockWriting" @click="mockAddRecord(10)">
            模拟完成 10 分钟
          </el-button>
          <el-button class="fm-button-primary" :loading="isMockWriting" :disabled="isMockWriting" @click="mockAddRecord(20)">
            模拟完成 20 分钟
          </el-button>
          <el-button class="fm-button-primary" :loading="isMockWriting" :disabled="isMockWriting" @click="mockAddRecord(30)">
            模拟完成 30 分钟
          </el-button>
        </div>
      </el-card>

      <el-button text class="workout-log__back" @click="router.push({ name: 'Home' })">返回首页</el-button>
    </main>

    <el-dialog v-model="detailVisible" title="当日训练详情" width="92%" align-center>
      <template v-if="selectedDate">
        <p class="workout-log__detail-date">{{ selectedDate }}</p>
        <template v-if="dayDetails.length > 0">
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
import { useAuthStore } from '@/store/auth';
import { workoutRecordsRepository } from '@/repositories';
import type { WorkoutRecordEntity } from '@/types/local-db';
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
const isMockWriting = ref(false);
const lastMockWriteAt = ref(0);
const detailRequestToken = ref(0);
const MOCK_WRITE_GAP_MS = 900;

const summary = computed(() => calculateWorkoutSummary(dailyPoints.value));
const heatmapRows = computed(() => buildHeatmapRows(dailyPoints.value));

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

  try {
    const { startDate, endDate, dates } = getRecentDateRange(42);
    const loaded = await workoutRecordsRepository.listRecordsByDateRange(userId, startDate, endDate);
    records.value = loaded;
    dailyPoints.value = buildDailyHeatmapPoints(loaded, dates);
  } catch {
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

  const requestToken = detailRequestToken.value + 1;
  detailRequestToken.value = requestToken;

  try {
    const details = await workoutRecordsRepository.listRecordsByDay(userId, date);
    if (requestToken !== detailRequestToken.value) {
      return;
    }

    dayDetails.value = details;
  } catch {
    if (requestToken !== detailRequestToken.value) {
      return;
    }

    ElMessage.error('读取当天详情失败，请稍后重试');
    dayDetails.value = [];
  }
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
  gap: 16px;
  padding: 20px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.workout-log__header {
  display: grid;
  gap: 8px;
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
  font-size: 30px;
  line-height: 1.05;
}

.workout-log__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.workout-log__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.workout-log__metric-label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.workout-log__metric-value {
  margin: 8px 0 0;
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 700;
}

.workout-log__card-head h2 {
  margin: 0;
  font-size: 18px;
}

.workout-log__card-head p {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.workout-log__heatmap {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.workout-log__heatmap-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.workout-log__cell {
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 9px;
  background: #17191e;
}

.workout-log__cell--level-1 {
  background: rgba(50, 213, 131, 0.16);
}

.workout-log__cell--level-2 {
  background: rgba(50, 213, 131, 0.32);
}

.workout-log__cell--level-3 {
  background: rgba(50, 213, 131, 0.56);
}

.workout-log__cell--level-4 {
  background: var(--color-primary);
}

.workout-log__actions {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
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
  margin: 12px 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.workout-log__detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
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
</style>
