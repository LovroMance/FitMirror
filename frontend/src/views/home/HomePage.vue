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

        <div class="home-view__metric-line">
          <p class="home-view__metric-text">
            <span>训练天数</span>
            <strong class="home-view__metric-value home-view__metric-value--warm">{{ summary.trainingDays }}</strong>
          </p>
          <p class="home-view__metric-text">
            <span>总时长</span>
            <strong class="home-view__metric-value home-view__metric-value--cool">{{ summary.totalDuration }} min</strong>
          </p>
          <p class="home-view__metric-text">
            <span>连续打卡</span>
            <strong class="home-view__metric-value home-view__metric-value--rose">{{ summary.streakDays }}D</strong>
          </p>
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
import PrimaryTabBar from '@/components/layout/PrimaryTabBar.vue';
import { useHomeDashboard } from '@/composables/home/useHomeDashboard';

const {
  handleGeneratePlan,
  handleOpenLibrary,
  handleOpenNutrition,
  handleOpenPlanHistory,
  homeRecommendations,
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

.home-view__metric-line {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.home-view__metric-text {
  margin: 0;
  display: grid;
  gap: 6px;
  text-align: left;
}

.home-view__metric-text span {
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.3;
}

.home-view__metric-value {
  font-size: 19px;
  line-height: 1.05;
  font-weight: 700;
}

.home-view__metric-value--warm {
  color: rgba(245, 196, 81, 0.92);
}

.home-view__metric-value--cool {
  color: rgba(133, 160, 255, 0.88);
}

.home-view__metric-value--rose {
  color: rgba(255, 152, 180, 0.9);
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

  .home-view__metric-line {
    gap: 8px;
  }

  .home-view__metric-value {
    font-size: 17px;
  }
}
</style>








