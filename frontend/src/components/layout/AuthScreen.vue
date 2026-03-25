<template>
  <div class="fm-auth-page">
    <main class="fm-auth-page__screen">
      <section class="fm-auth-page__header" :class="`fm-auth-page__header--${headerAlign}`">
        <slot name="header"></slot>
      </section>
      <section class="fm-auth-page__body">
        <slot></slot>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    headerAlign?: 'start' | 'center';
  }>(),
  {
    headerAlign: 'center'
  }
);
</script>

<style scoped>
.fm-auth-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  font-family: 'DM Sans', 'Inter', sans-serif;
}

.fm-auth-page__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, rgba(18, 26, 20, 0.92) 0%, rgba(11, 11, 14, 0.98) 24%),
    var(--color-bg-screen);
}

.fm-auth-page__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

.fm-auth-page__header--center {
  min-height: 240px;
  padding: 40px 24px 32px;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.fm-auth-page__header--start {
  padding: 32px 24px 24px;
  align-items: flex-start;
}

.fm-auth-page__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
