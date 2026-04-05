<template>
  <nav class="primary-tabbar" aria-label="主导航">
    <button
      v-for="item in primaryTabs"
      :key="item.routeName"
      type="button"
      class="primary-tabbar__item"
      :class="{ 'is-active': route.name === item.routeName }"
      @click="handleNavigate(item.routeName)"
    >
      <span class="primary-tabbar__icon" aria-hidden="true">
        <svg v-if="item.icon === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
        </svg>
        <svg v-else-if="item.icon === 'train'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 10h4l2-3 4 10 2-4h4" />
          <path d="M4 18h16" />
        </svg>
        <svg v-else-if="item.icon === 'nutrition'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M7 4v8" />
          <path d="M11 4v8" />
          <path d="M9 4v16" />
          <path d="M16 4c2.5 2.1 2.5 6 0 8.2V20" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
      </span>
      <span class="primary-tabbar__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { primaryTabs } from '@/config/home';

const router = useRouter();
const route = useRoute();

const handleNavigate = async (routeName: string): Promise<void> => {
  if (route.name === routeName) {
    return;
  }

  await router.push({ name: routeName });
};
</script>

<style scoped>
.primary-tabbar {
  position: fixed;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: min(366px, calc(100% - 20px));
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(27, 34, 34, 0.08);
  box-shadow:
    0 12px 28px rgba(37, 39, 46, 0.12),
    0 4px 10px rgba(37, 39, 46, 0.06);
  backdrop-filter: blur(12px);
}

.primary-tabbar__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 0 8px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: #8f908f;
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}

.primary-tabbar__item.is-active {
  background: #f1efe9;
  color: #202224;
  transform: translateY(-1px);
}

.primary-tabbar__icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.primary-tabbar__icon svg {
  width: 22px;
  height: 22px;
}

.primary-tabbar__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

@media (max-width: 420px) {
  .primary-tabbar {
    width: calc(100% - 12px);
    bottom: 8px;
    border-radius: 20px;
  }

  .primary-tabbar__label {
    font-size: 11px;
  }
}
</style>
