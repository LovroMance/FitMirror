<template>
  <div class="plan-history">
    <main class="plan-history__screen">
      <header class="plan-history__header">
        <p class="plan-history__eyebrow">Plan History</p>
        <h1 class="plan-history__title">历史训练计划</h1>
        <p class="plan-history__description">回看你生成过的训练计划，并从历史方案直接继续训练。</p>
      </header>

      <StatePanel
        v-if="pageState === 'loading'"
        variant="loading"
        title="正在加载历史计划"
        description="稍等片刻，我们正在读取你最近保存的训练方案。"
      />
      <StatePanel
        v-else-if="pageState === 'error'"
        variant="error"
        title="历史计划加载失败"
        :description="errorMessage"
        action-label="重新加载"
        @action="loadHistory"
      />
      <StatePanel
        v-else-if="pageState === 'empty'"
        variant="empty"
        title="还没有历史计划"
        description="先生成一份训练计划，后续就能在这里回看和复用。"
        action-label="去生成计划"
        @action="goToPlanGenerator"
      />
      <template v-else>
        <section class="plan-history__filters" aria-label="历史计划筛选">
          <el-button
            v-for="option in filterOptions"
            :key="option.value"
            text
            class="plan-history__filter"
            :class="{ 'plan-history__filter--active': selectedFilter === option.value }"
            @click="setFilter(option.value)"
          >
            {{ option.label }}
          </el-button>
        </section>

        <StatePanel
          v-if="filteredItems.length === 0"
          variant="empty"
          title="当前筛选下没有历史计划"
          description="切换筛选后再看看，或先去完成一次训练记录。"
          action-label="查看全部计划"
          @action="setFilter('all')"
        />
        <template v-else>
          <el-card
            v-for="item in filteredItems"
            :key="item.id"
            :id="`plan-history-card-${item.id}`"
            shadow="never"
            class="fm-card plan-history__card"
            :class="{ 'plan-history__card--highlighted': highlightedPlanId === item.id }"
          >
            <div class="plan-history__card-top">
              <div>
                <p class="plan-history__timestamp">{{ formatCreatedAt(item.createdAt) }}</p>
                <h2 class="plan-history__card-title">{{ item.title }}</h2>
                <p class="plan-history__goal">{{ item.goalText }}</p>
              </div>
              <span
                class="plan-history__level"
                :class="{ 'plan-history__level--invalid': !item.isValid }"
              >
                {{ item.isValid ? levelLabel(item.level) : '数据异常' }}
              </span>
            </div>

            <div class="plan-history__meta">
              <span>{{ item.durationMinutes }} 分钟</span>
              <span>{{ item.exerciseCount }} 个动作</span>
            </div>

            <p class="plan-history__usage-copy" :class="{ 'plan-history__usage-copy--active': item.usedWorkoutCount > 0 }">
              {{ usageSummary(item) }}
            </p>

            <div class="plan-history__actions">
              <el-button text class="plan-history__action-link" @click="toggleDetail(item.id)">
                {{ expandedPlanId === item.id ? '收起详情' : '查看详情' }}
              </el-button>
              <el-button
                class="fm-button-primary plan-history__action-primary"
                :disabled="!item.isValid"
                @click="startWorkout(item.id, item.isValid)"
              >
                开始训练
              </el-button>
              <el-button
                text
                class="plan-history__action-link"
                :disabled="!item.isValid"
                @click="reusePlan(item.id, item.isValid)"
              >
                复用到计划页
              </el-button>
              <el-button
                text
                type="danger"
                class="plan-history__action-link"
                :loading="deletingPlanId === item.id"
                :disabled="deletingPlanId === item.id"
                @click="deletePlan(item.id)"
              >
                删除计划
              </el-button>
            </div>

            <div v-if="expandedPlanId === item.id" class="plan-history__detail">
              <template v-if="item.isValid">
                <p class="plan-history__summary">{{ item.summary }}</p>
                <ul class="plan-history__exercise-list">
                  <li
                    v-for="(exercise, index) in item.exercises"
                    :key="`${item.id}-${exercise.name}-${index}`"
                    class="plan-history__exercise-item"
                  >
                    <div class="plan-history__exercise-top">
                      <span class="plan-history__exercise-index">#{{ index + 1 }}</span>
                      <strong>{{ exercise.name }}</strong>
                      <span>
                        {{ exercise.durationSeconds ? `${exercise.durationSeconds} 秒` : exercise.reps }}
                      </span>
                    </div>
                    <p>{{ exercise.instruction }}</p>
                    <small>休息 {{ exercise.restSeconds }} 秒</small>
                  </li>
                </ul>
              </template>
              <StatePanel
                v-else
                variant="error"
                title="该计划数据异常"
                description="该计划暂时无法展示详情，你仍可删除这条历史记录。"
              />
            </div>
          </el-card>
        </template>
      </template>

      <div class="plan-history__footer-actions">
        <el-button text class="plan-history__back" @click="goToPlanGenerator">返回计划页</el-button>
        <el-button text class="plan-history__back" @click="goHome">返回首页</el-button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import StatePanel from '@/components/common/StatePanel.vue';
import { usePlanHistory } from '@/composables/plan/usePlanHistory';

const {
  deletePlan,
  deletingPlanId,
  errorMessage,
  expandedPlanId,
  filteredItems,
  filterOptions,
  formatCreatedAt,
  goHome,
  goToPlanGenerator,
  highlightedPlanId,
  levelLabel,
  loadHistory,
  pageState,
  reusePlan,
  selectedFilter,
  setFilter,
  startWorkout,
  toggleDetail,
  usageSummary
} = usePlanHistory();
</script>

<style scoped>
.plan-history {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.plan-history__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 20px 110px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.plan-history__header {
  display: grid;
  gap: 10px;
}

.plan-history__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.plan-history__title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 34px;
  line-height: 1.08;
}

.plan-history__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.plan-history__card {
  display: grid;
  gap: 14px;
}

.plan-history__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.plan-history__filter {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.plan-history__filter--active {
  background: rgba(50, 213, 131, 0.16);
  color: var(--color-primary);
}

.plan-history__card--highlighted {
  border-color: rgba(110, 231, 168, 0.32);
  box-shadow: 0 0 0 1px rgba(110, 231, 168, 0.16);
}

.plan-history__card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plan-history__timestamp {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.plan-history__card-title {
  margin: 8px 0 0;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 600;
}

.plan-history__goal {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.plan-history__level {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.11);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.plan-history__level--invalid {
  background: rgba(255, 107, 107, 0.12);
  color: var(--color-danger);
}

.plan-history__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.plan-history__meta span {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.plan-history__usage-copy {
  margin: -4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.plan-history__usage-copy--active {
  color: var(--color-primary);
}

.plan-history__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-history__action-primary {
  min-height: 42px;
  border-radius: 14px;
}

.plan-history__action-link {
  padding-left: 0;
  padding-right: 0;
}

.plan-history__detail {
  display: grid;
  gap: 12px;
  padding-top: 2px;
}

.plan-history__summary {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.plan-history__exercise-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.plan-history__exercise-item {
  padding: 14px 14px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(22, 26, 24, 0.92), rgba(14, 17, 16, 0.92));
}

.plan-history__exercise-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plan-history__exercise-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.16);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.plan-history__exercise-top strong {
  flex: 1;
  font-size: 16px;
  line-height: 1.35;
}

.plan-history__exercise-top span:last-child {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.plan-history__exercise-item p {
  margin: 10px 0 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.plan-history__exercise-item small {
  color: var(--color-text-muted);
  font-size: 12px;
}

.plan-history__footer-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.plan-history__back {
  padding-left: 0;
  color: var(--color-text-secondary);
}

@media (max-width: 390px) {
  .plan-history__screen {
    padding: 16px 14px 104px;
  }

  .plan-history__title {
    font-size: 30px;
  }

  .plan-history__card-title {
    font-size: 22px;
  }

  .plan-history__actions {
    align-items: stretch;
  }

  .plan-history__action-primary {
    width: 100%;
  }
}
</style>
