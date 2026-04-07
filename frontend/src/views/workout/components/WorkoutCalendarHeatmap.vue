<template>
  <div ref="containerRef" class="workout-calendar-heatmap" aria-label="训练热图日历"></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import CalHeatmap from 'cal-heatmap';
import 'cal-heatmap/cal-heatmap.css';
import type { DailyHeatmapPoint } from '@/types/workout';

interface Props {
  points: DailyHeatmapPoint[];
  monthStart: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: 'selectDate', date: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
let calendar: CalHeatmap | null = null;
let paintToken = 0;

const source = computed(() =>
  props.points.map((point) => ({
    timestamp: dayjs(point.date, 'YYYY-MM-DD').startOf('day').valueOf(),
    intensity: point.intensityLevel
  }))
);

const paint = async (): Promise<void> => {
  const container = containerRef.value;
  if (!container) {
    return;
  }

  paintToken += 1;
  const currentToken = paintToken;

  if (calendar) {
    await calendar.destroy();
    calendar = null;
  }

  container.innerHTML = '';
  const nextCalendar = new CalHeatmap();
  calendar = nextCalendar;

  nextCalendar.on('click', (_event: unknown, timestamp?: number | null) => {
    if (!timestamp || !Number.isFinite(timestamp)) {
      return;
    }

    emit('selectDate', dayjs(timestamp).format('YYYY-MM-DD'));
  });

  try {
    await nextCalendar.paint({
      itemSelector: container,
      range: 1,
      domain: {
        type: 'month',
        gutter: 6,
        label: {
          text: null
        }
      },
      subDomain: {
        type: 'ghDay',
        width: 15,
        height: 15,
        gutter: 5,
        radius: 4
      },
      date: {
        start: dayjs(props.monthStart, 'YYYY-MM-DD').startOf('month').toDate(),
        locale: 'zh-cn'
      },
      data: {
        source: source.value,
        x: 'timestamp',
        y: 'intensity',
        groupY: 'max',
        defaultValue: 0
      },
      scale: {
        color: {
          type: 'threshold',
          domain: [1, 2, 3, 4],
          range: ['#16161a', '#244436', '#24c06f', '#32d583', '#6ee7a8']
        }
      }
    });
  } catch {
    container.innerHTML = '';
  }

  if (currentToken !== paintToken) {
    await nextCalendar.destroy();
    if (calendar === nextCalendar) {
      calendar = null;
    }
  }
};

onMounted(() => {
  void paint();
});

watch(
  () => [props.monthStart, props.points],
  () => {
    void paint();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  paintToken += 1;
  if (calendar) {
    void calendar.destroy();
    calendar = null;
  }
});
</script>

<style scoped>
.workout-calendar-heatmap {
  width: 100%;
  min-height: 148px;
  overflow-x: auto;
}

.workout-calendar-heatmap :deep(.ch-container) {
  width: fit-content;
  min-width: 100%;
}

.workout-calendar-heatmap :deep(.ch-subdomain-bg) {
  stroke: rgba(255, 255, 255, 0.07);
  transition: transform var(--duration-fast) ease;
}

.workout-calendar-heatmap :deep(.ch-subdomain-bg:hover) {
  transform: translateY(-1px);
}
</style>
