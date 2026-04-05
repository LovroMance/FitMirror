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

const { currentUser, handleLogout, quickActions } = useProfilePage();
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: linear-gradient(180deg, #f4f1ea 0%, #f7f5f0 100%);
  color: #202224;
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
  color: #728474;
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
  color: #6c6f76;
  font-size: 15px;
  line-height: 1.7;
}

.profile-page__identity,
.profile-page__account-card {
  display: flex;
  gap: 14px;
  padding: 18px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(34, 36, 40, 0.06);
  box-shadow: 0 10px 26px rgba(31, 35, 35, 0.05);
}

.profile-page__avatar {
  width: 58px;
  height: 58px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ecf5ee;
  color: #245d3f;
  font-size: 24px;
  font-weight: 700;
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
  color: #6c6f76;
  font-size: 14px;
}

.profile-page__action-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(34, 36, 40, 0.08);
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
  color: #6c6f76;
  font-size: 14px;
  line-height: 1.65;
}

.profile-page__action-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: #202224;
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

.profile-page__account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: #6c6f76;
  font-size: 14px;
}

.profile-page__account-row strong {
  color: #202224;
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
}
</style>
