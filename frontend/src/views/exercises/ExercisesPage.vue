<template>
  <div class="exercises-view">
    <main class="exercises-view__screen">
      <header class="exercises-view__header">
        <p class="exercises-view__eyebrow">Exercise Library</p>
        <h1 class="exercises-view__title">动作库</h1>
        <p class="exercises-view__description">按目标、部位和难度快速找到今天适合练的动作。</p>
      </header>

      <el-card shadow="never" class="fm-card exercises-view__card">
        <el-input
          v-model="filters.keyword"
          size="large"
          clearable
          class="fm-input exercises-view__search"
          placeholder="搜索动作、部位、关键词"
        />

        <div class="exercises-view__filters">
          <el-select v-model="filters.bodyPart" size="large" class="exercises-view__select">
            <el-option label="全部部位" value="all" />
            <el-option label="核心" value="core" />
            <el-option label="上肢" value="upper" />
            <el-option label="下肢" value="lower" />
            <el-option label="全身" value="full_body" />
            <el-option label="灵活恢复" value="mobility" />
          </el-select>
          <el-select v-model="filters.level" size="large" class="exercises-view__select">
            <el-option label="全部难度" value="all" />
            <el-option label="入门" value="beginner" />
            <el-option label="进阶" value="intermediate" />
            <el-option label="高阶" value="advanced" />
          </el-select>
          <el-select v-model="filters.equipment" size="large" class="exercises-view__select">
            <el-option label="全部器械" value="all" />
            <el-option label="无器械" value="none" />
            <el-option label="瑜伽垫" value="mat" />
            <el-option label="哑铃" value="dumbbell" />
            <el-option label="弹力带" value="band" />
            <el-option label="椅子" value="chair" />
          </el-select>
        </div>

        <div class="exercises-view__filter-actions">
          <span>共 {{ filteredExercises.length }} 个动作</span>
          <el-button text class="exercises-view__clear-btn" @click="resetFilters">清空筛选</el-button>
        </div>
      </el-card>

      <el-card shadow="never" class="fm-card exercises-view__card">
        <div class="exercises-view__card-head">
          <div>
            <h2>我的收藏</h2>
            <p>把常用动作留下来，下次更快开始。</p>
          </div>
        </div>
        <p v-if="favoriteExercises.length === 0" class="exercises-view__empty-tip">还没有收藏动作，看到适合的就先收起来。</p>
        <div v-else class="exercises-view__chips">
          <button
            v-for="item in favoriteExercises"
            :key="`favorite-${item.id}`"
            type="button"
            class="exercises-view__chip"
            @click="openExercise(item)"
          >
            {{ item.name }}
          </button>
        </div>
      </el-card>

      <el-card shadow="never" class="fm-card exercises-view__card">
        <div class="exercises-view__card-head">
          <div>
            <h2>最近查看</h2>
            <p>最近看过的动作会保留在这里，方便继续复练。</p>
          </div>
        </div>
        <p v-if="recentViewedExercises.length === 0" class="exercises-view__empty-tip">最近查看为空，打开一个动作详情后就会出现在这里。</p>
        <div v-else class="exercises-view__chips">
          <button
            v-for="item in recentViewedExercises"
            :key="`recent-${item.id}`"
            type="button"
            class="exercises-view__chip exercises-view__chip--muted"
            @click="openExercise(item)"
          >
            {{ item.name }}
          </button>
        </div>
      </el-card>

      <StatePanel
        v-if="loading"
        variant="loading"
        title="动作库加载中"
        description="正在读取本地动作数据，请稍等。"
      />

      <StatePanel
        v-else-if="errorMessage"
        variant="error"
        title="动作库加载失败"
        :description="errorMessage"
        action-label="重试加载"
        @action="loadExercises"
      />

      <StatePanel
        v-else-if="filteredExercises.length === 0"
        variant="empty"
        title="暂无匹配动作"
        description="可以尝试减少筛选条件或更换关键词。"
        action-label="重置筛选"
        @action="resetFilters"
      />

      <section v-else class="exercises-view__list">
        <el-card
          v-for="item in filteredExercises"
          :key="item.id"
          shadow="never"
          class="fm-card exercises-view__item"
          @click="openExercise(item)"
        >
          <div class="exercises-view__item-top">
            <h3>{{ item.name }}</h3>
            <div class="exercises-view__item-actions">
              <button
                type="button"
                class="exercises-view__favorite-btn"
                :class="{ 'is-active': item.isFavorite }"
                :aria-pressed="item.isFavorite"
                @click.stop="toggleFavorite(item)"
              >
                {{ item.isFavorite ? '已收藏' : '收藏' }}
              </button>
              <span>{{ levelLabel[item.level] }}</span>
            </div>
          </div>
          <p>{{ item.description }}</p>
          <div class="exercises-view__meta">
            <span>{{ bodyPartLabel[item.bodyPart] }}</span>
            <span>{{ equipmentLabel[item.equipment] }}</span>
            <span>{{ item.durationMinutes }} min</span>
          </div>
        </el-card>
      </section>

      <el-button text class="exercises-view__back" @click="backHome">返回首页</el-button>
    </main>

    <el-dialog v-model="detailVisible" title="动作详情" width="92%" align-center class="exercises-view__dialog">
      <template v-if="selectedExercise">
        <div class="exercises-view__dialog-top">
          <h3 class="exercises-view__dialog-title">{{ selectedExercise.name }}</h3>
          <el-button text class="exercises-view__dialog-favorite" @click="toggleFavorite(selectedExercise)">
            {{ selectedExercise.isFavorite ? '取消收藏' : '加入收藏' }}
          </el-button>
        </div>
        <p class="exercises-view__dialog-meta">
          {{ bodyPartLabel[selectedExercise.bodyPart] }} · {{ levelLabel[selectedExercise.level] }} ·
          {{ equipmentLabel[selectedExercise.equipment] }}
        </p>
        <p class="exercises-view__dialog-desc">{{ selectedExercise.description || '暂无动作描述' }}</p>

        <h4>建议训练</h4>
        <p class="exercises-view__dialog-block">
          {{ selectedExercise.sets }} 组 · {{ selectedExercise.reps || '按体能完成' }} ·
          {{ selectedExercise.durationMinutes }} 分钟
        </p>

        <h4>动作要点</h4>
        <ul class="exercises-view__dialog-list">
          <li v-for="(line, idx) in detailInstructions" :key="`ins-${idx}`">{{ line }}</li>
        </ul>

        <h4>注意事项</h4>
        <ul class="exercises-view__dialog-list">
          <li v-for="(line, idx) in detailTips" :key="`tip-${idx}`">{{ line }}</li>
        </ul>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import StatePanel from '@/components/common/StatePanel.vue';
import { useExerciseLibrary } from '@/composables/exercises/useExerciseLibrary';

const {
  backHome,
  bodyPartLabel,
  detailInstructions,
  detailTips,
  detailVisible,
  equipmentLabel,
  errorMessage,
  favoriteExercises,
  filteredExercises,
  filters,
  levelLabel,
  loadExercises,
  loading,
  openExercise,
  recentViewedExercises,
  resetFilters,
  selectedExercise,
  toggleFavorite
} = useExerciseLibrary();
</script>

<style scoped>
.exercises-view {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.exercises-view__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 20px 96px;
  background: linear-gradient(180deg, rgba(18, 26, 20, 0.95) 0%, rgba(11, 11, 14, 0.98) 30%), var(--color-bg-screen);
}

.exercises-view__header {
  display: grid;
  gap: 10px;
}

.exercises-view__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.exercises-view__title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 34px;
  line-height: 1.08;
}

.exercises-view__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.58;
}

.exercises-view__search {
  margin-bottom: 12px;
}

.exercises-view__filters {
  display: grid;
  gap: 10px;
}

.exercises-view__select :deep(.el-select__wrapper) {
  min-height: 48px;
  border-radius: 14px;
  background: #15181d;
  box-shadow: 0 0 0 1px var(--color-border) inset;
}

.exercises-view__select :deep(.el-select__selected-item) {
  font-size: 14px;
}

.exercises-view__filter-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.exercises-view__card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.exercises-view__card-head h2 {
  margin: 0;
  font-size: 20px;
  font-family: 'Fraunces', 'Times New Roman', serif;
}

.exercises-view__card-head p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.exercises-view__empty-tip {
  margin: 14px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.exercises-view__chips {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.exercises-view__chip {
  border: 1px solid rgba(50, 213, 131, 0.18);
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.08);
  color: var(--color-primary);
  padding: 7px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.exercises-view__chip--muted {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-secondary);
}

.exercises-view__clear-btn {
  font-size: 12px;
  font-weight: 600;
}

.exercises-view__list {
  display: grid;
  gap: 10px;
}

.exercises-view__item {
  cursor: pointer;
  transition:
    transform var(--duration-fast) ease,
    border-color var(--duration-fast) ease;
}

.exercises-view__item:hover {
  transform: translateY(-1px);
}

.exercises-view__item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.exercises-view__item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.exercises-view__item-top h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
}

.exercises-view__item-top span {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.exercises-view__favorite-btn {
  border: 1px solid rgba(50, 213, 131, 0.16);
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.08);
  color: var(--color-text-secondary);
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.exercises-view__favorite-btn.is-active {
  color: var(--color-primary);
  background: rgba(50, 213, 131, 0.16);
}

.exercises-view__item p {
  margin: 10px 0 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.exercises-view__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.exercises-view__meta span {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.12);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
}

.exercises-view__back {
  align-self: flex-start;
  color: var(--color-text-secondary);
}

.exercises-view__dialog-title {
  margin: 0;
  font-size: 22px;
}

.exercises-view__dialog-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.exercises-view__dialog-favorite {
  padding-right: 0;
}

.exercises-view__dialog-meta {
  margin: 8px 0 10px;
  color: var(--color-primary);
}

.exercises-view__dialog-desc {
  margin: 0 0 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.exercises-view__dialog-block {
  margin: 8px 0 14px;
  color: var(--color-text-secondary);
}

.exercises-view__dialog-list {
  margin: 8px 0 14px;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

@media (max-width: 390px) {
  .exercises-view__screen {
    padding: 16px 14px 88px;
    gap: 14px;
  }

  .exercises-view__title {
    font-size: 30px;
  }
}
</style>
