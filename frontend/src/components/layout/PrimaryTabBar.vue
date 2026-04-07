<template>
  <nav class="primary-tabbar" aria-label="主导航" :style="tabbarStyle">
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
        <svg v-else-if="item.icon === 'record'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
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
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { primaryTabs } from '@/config/home';

const router = useRouter();
const route = useRoute();
const tabbarStyle = computed(() => ({
  gridTemplateColumns: `repeat(${primaryTabs.length}, minmax(0, 1fr))`
}));

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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: min(430px, calc(100% - 20px));
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  border-radius: 24px;
  background: rgba(10, 14, 18, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 18px 36px rgba(0, 0, 0, 0.28),
    0 8px 18px rgba(0, 0, 0, 0.2);
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
  color: rgba(226, 232, 240, 0.62);
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}

.primary-tabbar__item.is-active {
  background: rgba(50, 213, 131, 0.12);
  color: var(--color-primary);
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
