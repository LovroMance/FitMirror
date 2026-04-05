<template>
  <div class="nutrition-page">
    <main class="nutrition-page__screen">
      <section class="nutrition-page__hero">
        <p class="nutrition-page__eyebrow">Fuel Better</p>
        <h1 class="nutrition-page__title">饮食管理</h1>
        <p class="nutrition-page__description">基于你的目标、偏好和补充要求，生成更容易执行的 1 天饮食建议。</p>
      </section>

      <section class="nutrition-page__content">
        <el-card shadow="never" class="fm-card nutrition-page__card">
          <template #header>
            <div class="nutrition-page__card-header">
              <div>
                <h2 class="nutrition-page__section-title">输入条件</h2>
                <p class="nutrition-page__section-note">首版会优先给出 1 天饮食原则、三餐和加餐建议。</p>
              </div>
            </div>
          </template>

          <div class="nutrition-page__field">
            <span class="nutrition-page__label">目标</span>
            <div class="nutrition-page__goal-grid">
              <button
                v-for="item in goalOptions"
                :key="item.value"
                type="button"
                class="nutrition-page__goal-item"
                :class="{ 'is-active': goal === item.value }"
                @click="goal = item.value"
              >
                <strong>{{ item.label }}</strong>
                <span>{{ item.description }}</span>
              </button>
            </div>
          </div>

          <div class="nutrition-page__field">
            <span class="nutrition-page__label">偏好</span>
            <el-checkbox-group v-model="preferences" class="nutrition-page__checkbox-group">
              <el-checkbox v-for="item in preferenceOptions" :key="item.value" :label="item.value">
                {{ item.label }}
              </el-checkbox>
            </el-checkbox-group>
          </div>

          <div class="nutrition-page__field">
            <span class="nutrition-page__label">补充要求或问题</span>
            <el-input
              v-model="note"
              type="textarea"
              :rows="3"
              resize="none"
              class="fm-textarea"
              placeholder="例如：不吃辣、工作日做饭时间少、减脂和增肌有什么不同"
            />
          </div>

          <el-button
            type="primary"
            size="large"
            class="fm-button-primary nutrition-page__submit"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="submitRecommendation"
          >
            生成饮食建议
          </el-button>
        </el-card>

        <StatePanel
          v-if="pageState === 'loading' && !hasResult"
          variant="loading"
          title="正在生成饮食建议"
          description="我正在结合饮食知识和营养信息整理今天的安排。"
        />

        <StatePanel
          v-if="pageState === 'error' && !hasResult"
          variant="error"
          title="饮食建议生成失败"
          :description="errorMessage"
          action-label="重新生成"
          @action="submitRecommendation"
        />

        <el-card v-if="hasResult && result" shadow="never" class="fm-card nutrition-page__card nutrition-page__result-card">
          <template #header>
            <div class="nutrition-page__card-header">
              <div>
                <h2 class="nutrition-page__section-title">今日建议</h2>
                <p class="nutrition-page__section-note">
                  已结合 {{ result.knowledgeMeta.guidelineCount }} 条饮食知识和 {{ result.knowledgeMeta.foodCount }} 条食物信息
                </p>
              </div>
              <span class="nutrition-page__result-badge">1 Day</span>
            </div>
          </template>

          <div class="nutrition-page__summary">
            <div v-if="isFallbackResult" class="nutrition-page__fallback-banner">
              <strong>本次为稳定推荐</strong>
              <p>AI 服务暂时波动，已自动切换为基于知识库的饮食建议，你仍可直接参考执行。</p>
            </div>
            <h3>推荐原则</h3>
            <div class="nutrition-page__summary-highlights">
              <span v-for="item in summaryViewModel.highlights" :key="item">{{ item }}</span>
            </div>
            <p>{{ result.summary }}</p>
          </div>

          <div class="nutrition-page__meal-grid">
            <article v-for="meal in mealCards" :key="meal.key" class="nutrition-page__meal-card">
              <div class="nutrition-page__meal-head">
                <span class="nutrition-page__meal-label">{{ meal.label }}</span>
                <div v-if="meal.portions.length > 0" class="nutrition-page__meal-portions">
                  <span v-for="portion in meal.portions" :key="portion">{{ portion }}</span>
                </div>
              </div>
              <h4>{{ meal.title }}</h4>
              <div v-if="meal.foods.length > 0" class="nutrition-page__meal-foods">
                <span v-for="food in meal.foods" :key="food">{{ food }}</span>
              </div>
              <p>{{ meal.detail }}</p>
            </article>
          </div>

          <div class="nutrition-page__tips">
            <h3>注意事项</h3>
            <ul>
              <li v-for="tip in result.tips" :key="tip">{{ tip }}</li>
            </ul>
          </div>

          <div class="nutrition-page__foods">
            <div class="nutrition-page__foods-header">
              <h3>相关食物营养信息</h3>
              <p>以下数据以每 100g 为单位展示。</p>
            </div>

            <article v-for="food in result.referencedFoods" :key="food.id" class="nutrition-page__food-card">
              <div class="nutrition-page__food-top">
                <div>
                  <h4>{{ food.name }}</h4>
                  <p>{{ food.highlights.join(' · ') }}</p>
                </div>
                <span>{{ food.unit }}</span>
              </div>
              <div class="nutrition-page__nutrition-grid">
                <div>
                  <span>蛋白质</span>
                  <strong>{{ food.nutritionPer100g.proteinG }}g</strong>
                </div>
                <div>
                  <span>碳水</span>
                  <strong>{{ food.nutritionPer100g.carbohydrateG }}g</strong>
                </div>
                <div>
                  <span>脂肪</span>
                  <strong>{{ food.nutritionPer100g.fatG }}g</strong>
                </div>
                <div>
                  <span>热量</span>
                  <strong>{{ food.nutritionPer100g.energyKcal }}kcal</strong>
                </div>
              </div>
              <p class="nutrition-page__food-benefit">{{ food.benefits.join(' ') }}</p>
            </article>
          </div>
        </el-card>

        <StatePanel
          v-else-if="pageState !== 'loading'"
          variant="empty"
          title="还没有饮食建议"
          description="先选一个目标，再告诉我你的偏好和补充要求。"
          action-label="开始生成"
          @action="submitRecommendation"
        />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatePanel from '@/components/common/StatePanel.vue';
import { useNutritionRecommendation } from '@/composables/nutrition/useNutritionRecommendation';
import { buildNutritionMealViewModels, buildNutritionSummaryViewModel } from '@/utils/nutrition-display';

const {
  note,
  canSubmit,
  errorMessage,
  goal,
  goalOptions,
  hasResult,
  isFallbackResult,
  pageState,
  preferenceOptions,
  preferences,
  result,
  submitRecommendation,
  submitting
} = useNutritionRecommendation();

const summaryViewModel = computed(() =>
  result.value
    ? buildNutritionSummaryViewModel(result.value)
    : {
        highlights: [],
        description: ''
      }
);

const mealCards = computed(() =>
  result.value ? buildNutritionMealViewModels(result.value.meals, result.value.referencedFoods) : []
);
</script>

<style scoped>
.nutrition-page {
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

.nutrition-page__screen {
  width: min(100%, 402px);
  min-height: 100vh;
  padding: 28px 20px 32px;
}

.nutrition-page__hero {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
}

.nutrition-page__eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.nutrition-page__title {
  margin: 0;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.nutrition-page__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.nutrition-page__content {
  display: grid;
  gap: 16px;
}

.nutrition-page__card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.nutrition-page__section-title,
.nutrition-page__summary h3,
.nutrition-page__tips h3,
.nutrition-page__foods-header h3 {
  margin: 0;
  font-size: 22px;
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-weight: 500;
}

.nutrition-page__section-note,
.nutrition-page__foods-header p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.nutrition-page__field {
  display: grid;
  gap: 10px;
}

.nutrition-page__field + .nutrition-page__field {
  margin-top: 14px;
}

.nutrition-page__label {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.nutrition-page__goal-grid {
  display: grid;
  gap: 10px;
}

.nutrition-page__goal-item {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) ease,
    background-color var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}

.nutrition-page__goal-item strong {
  font-size: 16px;
}

.nutrition-page__goal-item span {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.nutrition-page__goal-item.is-active {
  border-color: rgba(50, 213, 131, 0.64);
  background: rgba(50, 213, 131, 0.1);
  transform: translateY(-1px);
}

.nutrition-page__checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.nutrition-page__checkbox-group :deep(.el-checkbox) {
  margin-right: 0;
  color: var(--color-text-primary);
}

.nutrition-page__submit {
  width: 100%;
  height: 54px;
  margin-top: 16px;
  border-radius: 18px;
  font-size: 16px;
  font-weight: 700;
}

.nutrition-page__result-card {
  display: grid;
  gap: 20px;
}

.nutrition-page__result-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 36px;
  padding: 0 10px;
  border-radius: 14px;
  background: rgba(50, 213, 131, 0.12);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
}

.nutrition-page__summary {
  display: grid;
  gap: 8px;
}

.nutrition-page__fallback-banner {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(244, 192, 79, 0.12);
  border: 1px solid rgba(244, 192, 79, 0.26);
}

.nutrition-page__fallback-banner strong {
  color: #f4c04f;
  font-size: 13px;
  font-weight: 700;
}

.nutrition-page__fallback-banner p {
  margin: 0;
  color: rgba(255, 244, 214, 0.82);
  font-size: 13px;
  line-height: 1.6;
}

.nutrition-page__summary-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nutrition-page__summary-highlights span,
.nutrition-page__meal-portions span,
.nutrition-page__meal-foods span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(50, 213, 131, 0.1);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.nutrition-page__summary p,
.nutrition-page__meal-card p,
.nutrition-page__food-benefit {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.65;
}

.nutrition-page__meal-grid {
  display: grid;
  gap: 10px;
}

.nutrition-page__meal-card,
.nutrition-page__food-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.nutrition-page__meal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.nutrition-page__meal-label {
  display: inline-flex;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.nutrition-page__meal-portions,
.nutrition-page__meal-foods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nutrition-page__meal-card h4 {
  margin: 0 0 10px;
  color: var(--color-text-primary);
  font-size: 17px;
  line-height: 1.45;
}

.nutrition-page__meal-foods {
  margin-bottom: 10px;
}

.nutrition-page__tips ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--color-text-secondary);
  display: grid;
  gap: 8px;
}

.nutrition-page__foods {
  display: grid;
  gap: 12px;
}

.nutrition-page__foods-header {
  display: grid;
  gap: 4px;
}

.nutrition-page__food-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.nutrition-page__food-top h4 {
  margin: 0 0 6px;
  font-size: 17px;
}

.nutrition-page__food-top p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.nutrition-page__food-top span {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.nutrition-page__nutrition-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.nutrition-page__nutrition-grid div {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

.nutrition-page__nutrition-grid span {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.nutrition-page__nutrition-grid strong {
  font-size: 16px;
}

@media (max-width: 420px) {
  .nutrition-page__screen {
    padding: 24px 14px 28px;
  }

  .nutrition-page__title {
    font-size: 32px;
  }
}
</style>
