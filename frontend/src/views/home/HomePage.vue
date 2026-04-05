<template>
  <div class="home-view">
    <main class="home-view__screen">
      <section class="home-view__hero">
        <div class="home-view__hero-media" aria-hidden="true">
          <div class="home-view__hero-figure"></div>
        </div>
        <div class="home-view__hero-overlay"></div>
        <div class="home-view__hero-copy">
          <p class="home-view__hero-kicker">你的 AI 私教</p>
          <h1 class="home-view__hero-title">一面会说话的智能镜子</h1>
          <p class="home-view__hero-description">根据你的目标与状态，生成更适合今天的训练节奏。</p>
        </div>
      </section>

      <section class="home-view__content">
        <el-card shadow="never" class="fm-card home-view__card">
          <template #header>
            <div class="home-view__card-header">
              <div>
                <p class="home-view__section-eyebrow">Plan Today</p>
                <h2 class="home-view__section-title home-view__section-title--card">今日训练计划</h2>
                <p class="home-view__card-note">一句话描述目标，马上获得可执行训练方案。</p>
              </div>
              <el-button text class="home-view__history-link" @click="handleOpenPlanHistory">历史计划</el-button>
            </div>
          </template>
          <el-input
            v-model="planPrompt"
            type="textarea"
            :rows="3"
            resize="none"
            class="fm-textarea"
            placeholder="描述你的目标，例如：瘦肚子、无器械、20 分钟居家训练"
          />

          <el-button
            type="primary"
            size="large"
            class="fm-button-primary home-view__primary-button"
            @click="handleGeneratePlan"
          >
            AI 生成
          </el-button>
        </el-card>

        <el-card shadow="never" class="fm-card home-view__card">
          <template #header>
            <div class="home-view__card-header">
              <div>
                <h2 class="home-view__section-title home-view__section-title--card">打卡记录</h2>
                <p class="home-view__card-note">连续打卡 {{ summary.streakDays }} 天</p>
              </div>
              <span class="home-view__card-badge">{{ summary.streakDays }}D</span>
            </div>
          </template>
          <div class="home-view__summary-row">
            <div class="home-view__summary-item">
              <span>训练天数</span>
              <strong>{{ summary.trainingDays }}</strong>
            </div>
            <div class="home-view__summary-item">
              <span>总时长</span>
              <strong>{{ summary.totalDuration }} min</strong>
            </div>
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
          <div v-else class="heatmap" aria-label="最近六周训练热力图">
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
        </el-card>

        <el-card shadow="never" class="fm-card home-view__card home-view__nutrition-card">
          <template #header>
            <div class="home-view__card-header">
              <div>
                <p class="home-view__section-eyebrow">Eat Smarter</p>
                <h2 class="home-view__section-title home-view__section-title--card">饮食管理</h2>
                <p class="home-view__card-note">告诉我你的目标和偏好，生成今日饮食建议并查看关键营养信息。</p>
              </div>
            </div>
          </template>
          <div class="home-view__nutrition-body">
            <div class="home-view__nutrition-tags">
              <span>1 天方案</span>
              <span>营养卡片</span>
              <span>目标导向</span>
            </div>
            <el-button
              type="primary"
              size="large"
              class="fm-button-primary home-view__primary-button"
              @click="handleOpenNutrition"
            >
              开始饮食规划
            </el-button>
          </div>
        </el-card>

        <section class="home-view__recommend">
          <div class="home-view__section-head">
            <div>
              <p class="home-view__section-eyebrow">Move Better</p>
              <h2 class="home-view__section-title">推荐动作</h2>
            </div>
            <el-button text class="home-view__library-link" @click="handleOpenLibrary">查看动作库</el-button>
          </div>

          <el-card v-for="card in homeRecommendations" :key="card.title" shadow="never" class="fm-card recommend-card">
            <div class="recommend-card__visual" :class="card.visualClass"></div>
            <div class="recommend-card__body">
              <h3 class="recommend-card__title">{{ card.title }}</h3>
              <p class="recommend-card__tag">{{ card.tag }}</p>
              <div class="recommend-card__meta">
                <span>{{ card.duration }}</span>
                <span>{{ card.intensity }}</span>
              </div>
            </div>
          </el-card>
        </section>
      </section>

      <nav class="home-view__tabbar" aria-label="主导航">
        <button
          v-for="item in homeTabs"
          :key="item.label"
          type="button"
          class="home-view__tabbar-item"
          :class="{ 'is-active': isTabActive(item.routeName) }"
          @click="handleTabClick(item.routeName)"
        >
          <span class="home-view__tabbar-icon" aria-hidden="true">
            <svg v-if="item.icon === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5.5 9.5V20h13V9.5" />
            </svg>
            <svg v-else-if="item.icon === 'train'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 7h3l2 5 2-5h5" />
              <path d="M4 17h16" />
              <path d="M8 17V7" />
              <path d="M16 17V7" />
            </svg>
            <svg v-else-if="item.icon === 'log'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="4" y="11" width="3" height="7" rx="1.2" />
              <rect x="10.5" y="7" width="3" height="11" rx="1.2" />
              <rect x="17" y="4" width="3" height="14" rx="1.2" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19a7 7 0 0 1 14 0" />
            </svg>
          </span>
          <span class="home-view__tabbar-label">{{ item.label }}</span>
        </button>
      </nav>
    </main>
  </div>
</template>

<script setup lang="ts">
import StatePanel from '@/components/common/StatePanel.vue';
import { useHomeDashboard } from '@/composables/home/useHomeDashboard';

const {
  handleGeneratePlan,
  handleOpenLibrary,
  handleOpenNutrition,
  handleOpenPlanHistory,
  handleTabClick,
  heatmapError,
  heatmapState,
  homeHeatmapColumns,
  homeRecommendations,
  homeTabs,
  isTabActive,
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
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  font-family: 'DM Sans', 'PingFang SC', 'MiSans', 'Source Han Sans SC', sans-serif;
}

.home-view__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, rgba(18, 26, 20, 0.96) 0%, rgba(11, 11, 14, 0.98) 28%),
    var(--color-bg-screen);
}

.home-view__hero {
  position: relative;
  height: 318px;
  overflow: hidden;
}

.home-view__hero-media {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(140deg, rgba(71, 101, 76, 0.82) 0%, rgba(32, 40, 35, 0.9) 42%, rgba(10, 11, 13, 0.98) 100%);
}

.home-view__hero-media::before {
  content: '';
  position: absolute;
  top: 28px;
  right: -22px;
  width: 204px;
  height: 204px;
  border-radius: 44px;
  background:
    linear-gradient(135deg, rgba(50, 213, 131, 0.72) 0%, rgba(50, 213, 131, 0.16) 45%, rgba(11, 11, 14, 0) 100%);
  transform: rotate(14deg);
}

.home-view__hero-media::after {
  content: '';
  position: absolute;
  inset: 22px 26px 58px;
  border: 1px solid rgba(250, 250, 249, 0.08);
  border-radius: 30px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.01));
}

.home-view__hero-figure {
  position: absolute;
  right: 32px;
  bottom: 0;
  width: 156px;
  height: 224px;
  border-radius: 88px 88px 14px 14px;
  background:
    linear-gradient(180deg, rgba(245, 247, 242, 0.22) 0%, rgba(245, 247, 242, 0.08) 28%, rgba(11, 11, 14, 0) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    -20px 18px 48px rgba(0, 0, 0, 0.28);
}

.home-view__hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(11, 11, 14, 0) 18%, rgba(11, 11, 14, 0.82) 82%, #0b0b0e 100%);
}

.home-view__hero-copy {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 34px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 24px;
}

.home-view__hero-kicker,
.home-view__section-eyebrow {
  margin: 0 0 6px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-view__hero-title,
.home-view__section-title {
  margin: 0;
  color: var(--color-text-primary);
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.home-view__hero-title {
  max-width: 258px;
  font-size: 36px;
  line-height: 1.06;
}

.home-view__hero-description {
  margin: 0;
  max-width: 272px;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.home-view__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  padding: 16px 20px 116px;
}

.home-view__card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.home-view__primary-button {
  width: 100%;
  height: 56px;
  margin-top: 16px;
  border-radius: 18px;
  font-size: 16px;
  font-weight: 700;
}

.home-view__primary-button:disabled {
  opacity: 0.62;
}

.home-view__section-title--card {
  font-size: 26px;
  letter-spacing: -0.03em;
}

.home-view__card-note {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.home-view__history-link {
  color: var(--color-primary);
  padding-right: 0;
}

.home-view__card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 42px;
  padding: 0 10px;
  border-radius: 16px;
  background: rgba(50, 213, 131, 0.12);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 700;
}

.home-view__summary-row {
  margin: 0 0 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.home-view__summary-item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.home-view__summary-item span {
  color: var(--color-text-secondary);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.home-view__summary-item strong {
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 700;
}

.home-view__nutrition-card {
  overflow: hidden;
}

.home-view__nutrition-body {
  display: grid;
  gap: 14px;
}

.home-view__nutrition-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.home-view__nutrition-tags span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.1);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
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
  border-radius: 9px;
  background: #16161a;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.heatmap__cell--level-1 {
  background: #244436;
}

.heatmap__cell--level-2 {
  background: #24c06f;
}

.heatmap__cell--level-3 {
  background: #32d583;
}

.heatmap__cell--level-4 {
  background: #6ee7a8;
}

.home-view__section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}

.home-view__library-link {
  color: var(--color-primary);
  font-size: 13px;
  padding-right: 0;
}
.home-view__recommend {
  display: grid;
  gap: 12px;
}

.recommend-card :deep(.el-card__body) {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 14px;
  padding: 0;
}

.recommend-card__visual {
  min-height: 122px;
}

.recommend-card__visual--core {
  background:
    linear-gradient(135deg, rgba(50, 213, 131, 0.82) 0%, rgba(50, 213, 131, 0.16) 100%),
    linear-gradient(180deg, #1a201b 0%, #0d0f12 100%);
}

.recommend-card__visual--leg {
  background:
    linear-gradient(135deg, rgba(250, 250, 249, 0.26) 0%, rgba(50, 213, 131, 0.08) 100%),
    linear-gradient(180deg, #20242b 0%, #111318 100%);
}

.recommend-card__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding: 18px 16px 18px 0;
}

.recommend-card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.recommend-card__tag {
  margin: 0;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
}

.recommend-card__meta {
  display: flex;
  gap: 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
  flex-wrap: wrap;
}

.home-view__tabbar {
  position: fixed;
  bottom: 14px;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  width: min(366px, calc(100% - 24px));
  margin: 0 auto;
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(11, 11, 14, 0.86) 0%, rgba(11, 11, 14, 0.96) 100%);
  backdrop-filter: blur(14px);
}

.home-view__tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 0;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #64646c;
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease;
}

.home-view__tabbar-item.is-active {
  color: var(--color-primary);
  background: rgba(50, 213, 131, 0.08);
}

.home-view__tabbar-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.home-view__tabbar-icon svg {
  width: 22px;
  height: 22px;
}

.home-view__tabbar-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

@media (max-width: 420px) {
  .home-view__content {
    padding: 14px 14px 110px;
    gap: 16px;
  }

  .recommend-card :deep(.el-card__body) {
    grid-template-columns: 102px minmax(0, 1fr);
  }

  .home-view__hero-title {
    font-size: 32px;
  }

  .home-view__hero-description {
    max-width: 236px;
  }

  .home-view__tabbar {
    width: calc(100% - 16px);
    bottom: 8px;
    border-radius: 18px;
  }

  .home-view__tabbar-label {
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .home-view__summary-item strong {
    font-size: 14px;
  }
}
</style>
