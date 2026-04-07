<template>
  <div class="home-view">
    <main class="home-view__screen">
      <section class="home-view__hero">
        <p class="home-view__eyebrow">Today With FitMirror</p>
        <div class="home-view__hero-head">
          <div>
            <h1 class="home-view__title">今天更适合稳一点，还是狠一点？</h1>
            <p class="home-view__description">先定训练目标，再安排饮食和节奏。首页只保留你今天最常用的入口。</p>
          </div>
          <button type="button" class="home-view__hero-link" @click="handleOpenPlanHistory">历史计划</button>
        </div>
      </section>

      <section class="home-view__composer">
        <div class="home-view__section-head">
          <div>
            <p class="home-view__section-kicker">训练计划</p>
            <h2>一句话开始今天的训练</h2>
          </div>
          <span class="home-view__pill">AI 辅助</span>
        </div>

        <el-input
          v-model="planPrompt"
          type="textarea"
          :rows="3"
          resize="none"
          class="fm-textarea"
          placeholder="例如：瘦肚子、无器械、20 分钟居家训练"
        />

        <div class="home-view__composer-actions">
          <el-button type="primary" size="large" class="fm-button-primary home-view__primary-button" @click="handleGeneratePlan">
            生成训练计划
          </el-button>
          <button type="button" class="home-view__text-action" @click="handleOpenLibrary">动作库</button>
        </div>
      </section>

      <section class="home-view__summary">
        <div class="home-view__summary-head">
          <div>
            <p class="home-view__section-kicker">今日概览</p>
            <h2>训练积累</h2>
          </div>
          <strong>{{ summary.streakDays }} 天连续</strong>
        </div>

        <div class="home-view__metric-grid">
          <article class="home-view__metric home-view__metric--warm">
            <span>训练天数</span>
            <strong>{{ summary.trainingDays }}</strong>
          </article>
          <article class="home-view__metric home-view__metric--cool">
            <span>总时长</span>
            <strong>{{ summary.totalDuration }} min</strong>
          </article>
          <article class="home-view__metric home-view__metric--rose">
            <span>连续打卡</span>
            <strong>{{ summary.streakDays }}D</strong>
          </article>
        </div>

        <StatePanel
          v-if="heatmapState === 'loading'"
          variant="loading"
          title="正在加载训练热图"
          description="稍等片刻，我们正在读取你的最近训练记录。"
        />
        <StatePanel
          v-else-if="heatmapState === 'error'"
          variant="error"
          title="热图加载失败"
          :description="heatmapError"
          action-label="重试加载"
          @action="loadHeatmap"
        />
        <StatePanel
          v-else-if="heatmapState === 'empty'"
          variant="empty"
          title="今天还没有训练记录"
          description="先完成一次训练，热图会自动点亮。"
          action-label="去生成训练计划"
          @action="handleGeneratePlan"
        />
        <div v-else class="home-view__heatmap-wrap">
          <div class="heatmap" aria-label="最近六周训练热力图">
            <div
              v-for="(column, columnIndex) in homeHeatmapColumns"
              :key="`col-${columnIndex}`"
              class="heatmap__column"
            >
              <span
                v-for="(point, rowIndex) in column"
                :key="`cell-${columnIndex}-${rowIndex}`"
                class="heatmap__cell"
                :class="`heatmap__cell--level-${point.intensityLevel}`"
                :title="buildHeatmapTooltip(point.date, point.count, point.totalDuration)"
                :aria-label="buildHeatmapTooltip(point.date, point.count, point.totalDuration)"
              ></span>
            </div>
          </div>
        </div>
      </section>

      <section class="home-view__nutrition">
        <div class="home-view__section-head">
          <div>
            <p class="home-view__section-kicker">饮食计划</p>
            <h2>今天吃什么，也一起定掉</h2>
          </div>
        </div>

        <div class="home-view__nutrition-body">
          <div class="home-view__nutrition-copy">
            <p>饮食建议现在支持直接回答“减脂和增肌有什么不同”这类问题，也会给出更结构化的餐次安排。</p>
            <div class="home-view__nutrition-tags">
              <span>显式回答</span>
              <span>结构化餐次</span>
              <span>快手执行</span>
            </div>
          </div>
          <el-button type="primary" size="large" class="fm-button-primary home-view__nutrition-button" @click="handleOpenNutrition">
            去做饮食计划
          </el-button>
        </div>
      </section>

      <section class="home-view__recommend">
        <div class="home-view__section-head">
          <div>
            <p class="home-view__section-kicker">推荐动作</p>
            <h2>先热起来</h2>
          </div>
        </div>

        <div class="home-view__recommend-list">
          <article v-for="card in homeRecommendations" :key="card.title" class="home-view__recommend-item">
            <div class="home-view__recommend-visual" :class="card.visualClass"></div>
            <div class="home-view__recommend-body">
              <h3>{{ card.title }}</h3>
              <p>{{ card.tag }}</p>
              <div class="home-view__recommend-meta">
                <span>{{ card.duration }}</span>
                <span>{{ card.intensity }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <PrimaryTabBar />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import StatePanel from '@/components/common/StatePanel.vue';
import PrimaryTabBar from '@/components/layout/PrimaryTabBar.vue';
import { useHomeDashboard } from '@/composables/home/useHomeDashboard';


const {
  handleGeneratePlan,
  handleOpenLibrary,
  handleOpenNutrition,
  handleOpenPlanHistory,
  heatmapError,
  heatmapState,
  homeHeatmapColumns,
  homeRecommendations,
  loadHeatmap,
  planPrompt,
  summary
} = useHomeDashboard();

const buildHeatmapTooltip = (date: string, count: number, totalDuration: number): string => {
  const formattedDate = dayjs(date).format('MM月DD日');
  const countLabel = `${count} 次训练`;
  const durationLabel = `${totalDuration} 分钟`;
  return `${formattedDate} | ${countLabel} | ${durationLabel}`;
};
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background:
    radial-gradient(circle at top center, rgba(50, 213, 131, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(18, 26, 20, 0.96) 0%, rgba(11, 11, 14, 0.98) 30%),
    var(--color-bg-page);
  color: var(--color-text-primary);
  font-family: 'DM Sans', 'PingFang SC', 'MiSans', 'Source Han Sans SC', sans-serif;
}

.home-view__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  padding: 28px 20px 112px;
  display: grid;
  gap: 18px;
}

.home-view__hero,
.home-view__composer,
.home-view__summary,
.home-view__nutrition,
.home-view__recommend {
  display: grid;
  gap: 14px;
}

.home-view__eyebrow,
.home-view__section-kicker {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.home-view__hero-head,
.home-view__section-head,
.home-view__summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.home-view__title,
.home-view__section-head h2,
.home-view__summary-head h2 {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.home-view__title {
  font-size: 35px;
  line-height: 1.04;
}

.home-view__section-head h2,
.home-view__summary-head h2 {
  font-size: 28px;
  line-height: 1.08;
}

.home-view__description {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.7;
}

.home-view__hero-link,
.home-view__text-action,
.home-view__inline-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.home-view__composer,
.home-view__summary,
.home-view__nutrition {
  padding: 18px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(22, 22, 26, 0.96), rgba(18, 19, 22, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22);
}

.home-view__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.12);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.home-view__composer-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.home-view__primary-button,
.home-view__nutrition-button {
  flex: 1;
  min-height: 52px;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 700;
}

.home-view__summary-head strong {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.home-view__metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.home-view__metric {
  display: grid;
  gap: 6px;
  min-height: 84px;
  padding: 12px 8px;
  border-radius: 16px;
  text-align: center;
}

.home-view__metric span {
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.3;
}

.home-view__metric strong {
  font-size: 20px;
  line-height: 1.05;
  color: var(--color-text-primary);
}

.home-view__metric--warm {
  background: rgba(245, 196, 81, 0.1);
}

.home-view__metric--cool {
  background: rgba(110, 140, 255, 0.1);
}

.home-view__metric--rose {
  background: rgba(255, 130, 160, 0.1);
}

.home-view__heatmap-wrap {
  display: grid;
  gap: 10px;
}

.heatmap {
  width: min(100%, 332px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.heatmap__column {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.heatmap__cell {
  aspect-ratio: 1;
  border-radius: 8px;
  background: #16161a;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.heatmap__cell--level-1 {
  background: #1b3c30;
}

.heatmap__cell--level-2 {
  background: #236f52;
}

.heatmap__cell--level-3 {
  background: #29a56f;
}

.heatmap__cell--level-4 {
  background: #44d08c;
}

.home-view__nutrition-body {
  display: grid;
  gap: 14px;
}

.home-view__nutrition-copy p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.home-view__nutrition-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.home-view__nutrition-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.1);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.home-view__recommend-list {
  display: grid;
  gap: 10px;
}

.home-view__recommend-item {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.home-view__recommend-item:last-child {
  border-bottom: 0;
}

.home-view__recommend-visual {
  min-height: 88px;
  border-radius: 22px;
}

.recommend-card__visual--core {
  background:
    linear-gradient(135deg, rgba(50, 213, 131, 0.78) 0%, rgba(50, 213, 131, 0.16) 100%),
    linear-gradient(180deg, #1a201b 0%, #0d0f12 100%);
}

.recommend-card__visual--leg {
  background:
    linear-gradient(135deg, rgba(250, 250, 249, 0.24) 0%, rgba(50, 213, 131, 0.08) 100%),
    linear-gradient(180deg, #20242b 0%, #111318 100%);
}

.home-view__recommend-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.home-view__recommend-body h3 {
  margin: 0;
  font-size: 18px;
}

.home-view__recommend-body p {
  margin: 0;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
}

.home-view__recommend-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

@media (max-width: 420px) {
  .home-view__screen {
    padding: 24px 14px 108px;
    gap: 16px;
  }

  .home-view__title {
    font-size: 31px;
  }

  .home-view__section-head h2,
  .home-view__summary-head h2 {
    font-size: 25px;
  }

  .home-view__metric-grid {
    gap: 8px;
  }

  .home-view__metric {
    min-height: 78px;
    padding: 10px 6px;
  }

  .home-view__metric strong {
    font-size: 18px;
  }

  .heatmap {
    width: min(100%, 312px);
    gap: 5px;
  }

  .heatmap__column {
    gap: 5px;
  }

  .heatmap__cell {
    border-radius: 7px;
  }
}
</style>
