<template>
  <AuthScreen header-align="center">
    <template #header>
      <div class="login-view__logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#0B0B0E" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <h1 class="login-view__brand-name">FitMirror</h1>
      <p class="login-view__tagline">开始你的 AI 健身之旅</p>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="fm-auth-form login-view__form"
      @submit.prevent="handleLogin"
    >
      <el-form-item label="邮箱 / 用户名" prop="account" class="login-view__item">
        <el-input
          v-model="form.account"
          size="large"
          class="fm-input"
          placeholder="输入邮箱或用户名"
          autocomplete="username"
        />
      </el-form-item>

      <el-form-item label="密码" prop="password" class="login-view__item">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          size="large"
          class="fm-input"
          placeholder="输入密码"
          autocomplete="current-password"
        />
      </el-form-item>

      <div class="login-view__actions">
        <router-link to="/register" class="login-view__link">还没有账号？</router-link>
        <button type="button" class="login-view__text-button">忘记密码</button>
      </div>

      <el-button type="primary" size="large" class="fm-button-primary login-view__primary" @click="handleLogin">
        登录
      </el-button>

      <div class="login-view__divider" aria-hidden="true">
        <span></span>
        <em>或</em>
        <span></span>
      </div>

      <el-button size="large" class="fm-button-secondary login-view__secondary">
        <svg class="login-view__github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"
          />
        </svg>
        使用 GitHub 登录
      </el-button>

      <div class="login-view__footer">
        <span>第一次来 FitMirror？</span>
        <router-link to="/register" class="login-view__link">立即注册</router-link>
      </div>
    </el-form>
  </AuthScreen>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import AuthScreen from '@/components/layout/AuthScreen.vue';

interface LoginForm {
  account: string;
  password: string;
}

const router = useRouter();
const formRef = ref<FormInstance>();

const form = reactive<LoginForm>({
  account: '',
  password: ''
});

const rules: FormRules<LoginForm> = {
  account: [
    { required: true, message: '请输入邮箱或用户名', trigger: 'blur' },
    { min: 3, message: '至少输入 3 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' }
  ]
};

const handleLogin = async () => {
  const valid = await formRef.value?.validate().catch(() => false);

  if (!valid) {
    return;
  }

  ElMessage.success('登录信息已通过校验');
  router.push('/');
};
</script>

<style scoped>
.login-view__logo {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: linear-gradient(180deg, var(--color-primary-soft) 0%, var(--color-primary) 100%);
  box-shadow: var(--shadow-primary);
}

.login-view__logo svg {
  width: 30px;
  height: 30px;
}

.login-view__brand-name {
  margin: 0;
  color: var(--color-text-primary);
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.login-view__tagline {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.login-view__form {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 24px 40px;
  box-sizing: border-box;
}

.login-view__item {
  margin-bottom: 18px;
}

.login-view__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -2px 0 18px;
}

.login-view__link,
.login-view__text-button {
  color: var(--color-primary);
  font-size: 13px;
  text-decoration: none;
}

.login-view__text-button {
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.login-view__primary,
.login-view__secondary {
  width: 100%;
  height: 56px;
  margin: 0;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 700;
}

.login-view__github-icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
}

.login-view__divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  margin: 18px 0;
}

.login-view__divider span {
  height: 1px;
  background: var(--color-border);
}

.login-view__divider em {
  color: var(--color-text-muted);
  font-size: 13px;
  font-style: normal;
}

.login-view__footer {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
