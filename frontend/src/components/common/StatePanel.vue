<template>
  <section class="state-panel" :class="`state-panel--${variant}`" role="status" :aria-live="liveMode">
    <p class="state-panel__title">{{ title }}</p>
    <p v-if="description" class="state-panel__description">{{ description }}</p>
    <el-button v-if="actionLabel" text class="state-panel__action" @click="emit('action')">
      {{ actionLabel }}
    </el-button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'loading' | 'error' | 'empty';
  title: string;
  description?: string;
  actionLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'loading',
  description: '',
  actionLabel: ''
});

const emit = defineEmits<{
  action: [];
}>();

const liveMode = computed(() => (props.variant === 'error' ? 'assertive' : 'polite'));
</script>

<style scoped>
.state-panel {
  display: grid;
  gap: 7px;
  padding: 15px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(22, 24, 28, 0.94), rgba(15, 17, 20, 0.94));
}

.state-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.state-panel__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.state-panel__action {
  justify-self: flex-start;
  margin-left: -4px;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
}

.state-panel--loading .state-panel__title {
  color: var(--color-primary);
}

.state-panel--error .state-panel__title {
  color: var(--color-danger);
}

.state-panel--empty .state-panel__title {
  color: var(--color-text-secondary);
}
</style>
