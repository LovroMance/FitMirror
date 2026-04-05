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
                v-for="(level, rowIndex) in column"
                :key="`cell-${columnIndex}-${rowIndex}`"
                class="heatmap__cell"
                :class="`heatmap__cell--level-${level}`"
              ></span>
            </div>
          </div>
          <button type="button" class="home-view__inline-link" @click="router.push({ name: 'WorkoutLog' })">查看训练记录</button>
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
import { useRouter } from 'vue-router';
import StatePanel from '@/components/common/StatePanel.vue';
import PrimaryTabBar from '@/components/layout/PrimaryTabBar.vue';
import { useHomeDashboard } from '@/composables/home/useHomeDashboard';

const router = useRouter();

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
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background:
    linear-gradient(180deg, #f4f1ea 0%, #f7f5f0 34%, #f8f7f3 100%);
  color: #1c1d1f;
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
  color: #6d7f70;
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
  color: #6f7177;
  font-size: 15px;
  line-height: 1.7;
}

.home-view__hero-link,
.home-view__text-action,
.home-view__inline-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: #222428;
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
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(34, 36, 40, 0.06);
  box-shadow: 0 10px 26px rgba(31, 35, 35, 0.05);
}

.home-view__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #ecf5ee;
  color: #245d3f;
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
  color: #202224;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.home-view__metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.home-view__metric {
  display: grid;
  gap: 8px;
  min-height: 108px;
  padding: 16px 10px;
  border-radius: 18px;
  text-align: center;
}

.home-view__metric span {
  color: #73767d;
  font-size: 12px;
  line-height: 1.4;
}

.home-view__metric strong {
  font-size: 22px;
  line-height: 1.1;
}

.home-view__metric--warm {
  background: #f7efe2;
}

.home-view__metric--cool {
  background: #eceff8;
}

.home-view__metric--rose {
  background: #f8e8eb;
}

.home-view__heatmap-wrap {
  display: grid;
  gap: 10px;
}

.heatmap {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.heatmap__column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.heatmap__cell {
  aspect-ratio: 1;
  border-radius: 10px;
  background: #ebebe8;
}

.heatmap__cell--level-1 {
  background: #d8e7dd;
}

.heatmap__cell--level-2 {
  background: #9fd8b1;
}

.heatmap__cell--level-3 {
  background: #5ac77d;
}

.heatmap__cell--level-4 {
  background: #32d583;
}

.home-view__nutrition-body {
  display: grid;
  gap: 14px;
}

.home-view__nutrition-copy p {
  margin: 0;
  color: #646770;
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
  background: #f1efe9;
  color: #44484d;
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
  border-bottom: 1px solid rgba(34, 36, 40, 0.08);
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
    linear-gradient(180deg, #eef7f1 0%, #e2efe7 100%);
}

.recommend-card__visual--leg {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.86) 0%, rgba(80, 108, 88, 0.12) 100%),
    linear-gradient(180deg, #ece9e3 0%, #e2ded6 100%);
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
  color: #64836b;
  font-size: 13px;
  font-weight: 700;
}

.home-view__recommend-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #74777f;
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
    gap: 10px;
  }

  .home-view__metric {
    min-height: 98px;
    padding: 14px 8px;
  }

  .home-view__metric strong {
    font-size: 20px;
  }
}
</style>
