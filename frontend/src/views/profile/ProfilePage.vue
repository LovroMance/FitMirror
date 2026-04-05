<template>
  <div class="profile-page">
    <main class="profile-page__screen">
      <section class="profile-page__hero">
        <p class="profile-page__eyebrow">Personal Space</p>
        <h1 class="profile-page__title">个人资料</h1>
        <p class="profile-page__description">先放一个简洁版本，把账号信息和最常用的个人入口收在一起。</p>
      </section>

      <section class="profile-page__identity">
        <div class="profile-page__avatar" aria-hidden="true">{{ (currentUser?.username || 'F').slice(0, 1).toUpperCase() }}</div>
        <div class="profile-page__identity-copy">
          <strong>{{ currentUser?.username || 'FitMirror 用户' }}</strong>
          <span>{{ currentUser?.email || '未读取到邮箱信息' }}</span>
        </div>
      </section>

      <section class="profile-page__section">
        <div class="profile-page__section-head">
          <div>
            <p class="profile-page__section-kicker">同步概览</p>
            <h2>当前状态</h2>
          </div>
        </div>

        <div class="profile-page__stats-grid">
          <article class="profile-page__stat profile-page__stat--warm">
            <span>保存计划</span>
            <strong>{{ stats.savedPlans }}</strong>
          </article>
          <article class="profile-page__stat profile-page__stat--cool">
            <span>训练记录</span>
            <strong>{{ stats.workoutRecords }}</strong>
          </article>
          <article class="profile-page__stat profile-page__stat--mint">
            <span>完成训练</span>
            <strong>{{ stats.completedWorkouts }}</strong>
          </article>
        </div>

        <div class="profile-page__sync-card">
          <span>同步说明</span>
          <strong>{{ syncSummary }}</strong>
          <p v-if="settings">上次本地偏好更新：{{ settings.updatedAt.slice(0, 10) }}</p>
        </div>
      </section>

      <section class="profile-page__section">
        <div class="profile-page__section-head">
          <div>
            <p class="profile-page__section-kicker">快捷入口</p>
            <h2>你最常回看的内容</h2>
          </div>
        </div>

        <article v-for="item in quickActions" :key="item.title" class="profile-page__action-card">
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
          <button type="button" class="profile-page__action-link" @click="item.action()">{{ item.actionLabel }}</button>
        </article>
      </section>

      <section class="profile-page__section">
        <div class="profile-page__section-head">
          <div>
            <p class="profile-page__section-kicker">偏好</p>
            <h2>一些基础设置</h2>
          </div>
        </div>

        <div class="profile-page__preference-card">
          <div class="profile-page__preference-row">
            <div>
              <strong>界面主题</strong>
              <p>当前先支持记录你偏好的亮色 / 深色风格。</p>
            </div>
            <div class="profile-page__choice-group">
              <button
                type="button"
                class="profile-page__choice"
                :class="{ 'is-active': settings?.theme === 'light' }"
                @click="handleThemeChange('light')"
              >
                亮色
              </button>
              <button
                type="button"
                class="profile-page__choice"
                :class="{ 'is-active': settings?.theme === 'dark' }"
                @click="handleThemeChange('dark')"
              >
                深色
              </button>
            </div>
          </div>

          <div class="profile-page__preference-row">
            <div>
              <strong>计量单位</strong>
              <p>先把常见的公制 / 英制偏好记下来，后续页面可以继续跟进。</p>
            </div>
            <div class="profile-page__choice-group">
              <button
                type="button"
                class="profile-page__choice"
                :class="{ 'is-active': settings?.unit === 'metric' }"
                @click="handleUnitChange('metric')"
              >
                公制
              </button>
              <button
                type="button"
                class="profile-page__choice"
                :class="{ 'is-active': settings?.unit === 'imperial' }"
                @click="handleUnitChange('imperial')"
              >
                英制
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="profile-page__section">
        <div class="profile-page__section-head">
          <div>
            <p class="profile-page__section-kicker">账号</p>
            <h2>保持简单就好</h2>
          </div>
        </div>

        <div class="profile-page__account-card">
          <div class="profile-page__account-row">
            <span>当前登录</span>
            <strong>{{ currentUser?.username || '未登录' }}</strong>
          </div>
          <div class="profile-page__account-row">
            <span>同步状态</span>
            <strong>已启用计划与记录同步</strong>
          </div>
          <el-button type="danger" plain class="profile-page__logout" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
    </main>

    <PrimaryTabBar />
  </div>
</template>

<script setup lang="ts">
import PrimaryTabBar from '@/components/layout/PrimaryTabBar.vue';
import { useProfilePage } from '@/composables/profile/useProfilePage';

const { currentUser, handleLogout, handleThemeChange, handleUnitChange, quickActions, settings, stats, syncSummary } =
  useProfilePage();
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background:
    radial-gradient(circle at top right, rgba(50, 213, 131, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(18, 26, 20, 0.98) 0%, rgba(11, 11, 14, 1) 38%),
    var(--color-bg-page);
  color: var(--color-text-primary);
  font-family: 'DM Sans', 'PingFang SC', 'MiSans', 'Source Han Sans SC', sans-serif;
}

.profile-page__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  padding: 28px 20px 112px;
  display: grid;
  gap: 18px;
}

.profile-page__hero,
.profile-page__section {
  display: grid;
  gap: 14px;
}

.profile-page__eyebrow,
.profile-page__section-kicker {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-page__title,
.profile-page__section-head h2 {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.profile-page__title {
  font-size: 34px;
}

.profile-page__section-head h2 {
  font-size: 28px;
}

.profile-page__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.7;
}

.profile-page__identity,
.profile-page__account-card,
.profile-page__sync-card,
.profile-page__preference-card {
  display: flex;
  gap: 14px;
  padding: 18px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(22, 22, 26, 0.96), rgba(18, 19, 22, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22);
}

.profile-page__avatar {
  width: 58px;
  height: 58px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(50, 213, 131, 0.2) 0%, rgba(50, 213, 131, 0.08) 100%),
    rgba(18, 19, 22, 0.92);
  color: var(--color-primary);
  font-size: 24px;
  font-weight: 700;
  border: 1px solid rgba(50, 213, 131, 0.12);
}

.profile-page__identity-copy {
  display: grid;
  align-content: center;
  gap: 6px;
}

.profile-page__identity-copy strong {
  font-size: 20px;
}

.profile-page__identity-copy span {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.profile-page__stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.profile-page__stat {
  display: grid;
  gap: 8px;
  min-height: 104px;
  padding: 14px 10px;
  border-radius: 18px;
  text-align: center;
}

.profile-page__stat span {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.profile-page__stat strong {
  font-size: 22px;
  color: var(--color-text-primary);
}

.profile-page__stat--warm {
  background: rgba(245, 196, 81, 0.1);
}

.profile-page__stat--cool {
  background: rgba(110, 140, 255, 0.1);
}

.profile-page__stat--mint {
  background: rgba(50, 213, 131, 0.1);
}

.profile-page__sync-card,
.profile-page__preference-card {
  display: grid;
}

.profile-page__sync-card span {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.profile-page__sync-card strong {
  font-size: 16px;
  line-height: 1.6;
}

.profile-page__sync-card p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.profile-page__action-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.profile-page__action-card:last-child {
  border-bottom: 0;
}

.profile-page__action-card h3 {
  margin: 0;
  font-size: 18px;
}

.profile-page__action-card p {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.65;
}

.profile-page__action-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.profile-page__account-card {
  display: grid;
  gap: 14px;
}

.profile-page__preference-row {
  display: grid;
  gap: 12px;
}

.profile-page__preference-row + .profile-page__preference-row {
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.profile-page__preference-row strong {
  display: block;
  font-size: 16px;
}

.profile-page__preference-row p {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.profile-page__choice-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-page__choice {
  min-width: 74px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.profile-page__choice.is-active {
  background: rgba(50, 213, 131, 0.14);
  color: var(--color-primary);
  border-color: rgba(50, 213, 131, 0.28);
}

.profile-page__account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.profile-page__account-row strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.profile-page__logout {
  min-height: 46px;
  border-radius: 16px;
}

@media (max-width: 420px) {
  .profile-page__screen {
    padding: 24px 14px 108px;
  }

  .profile-page__title {
    font-size: 30px;
  }

  .profile-page__section-head h2 {
    font-size: 24px;
  }

  .profile-page__stats-grid {
    gap: 10px;
  }

  .profile-page__stat {
    min-height: 94px;
    padding: 12px 8px;
  }
}
</style>
