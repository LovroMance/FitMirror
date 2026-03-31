<template>
  <AuthScreen header-align="start">
    <template #header>
      <router-link to="/login" class="register-view__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        返回登录
      </router-link>
      <h1 class="register-view__title">创建账号</h1>
      <p class="register-view__subtitle">加入 FitMirror，开始你的 AI 私教之旅。</p>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="fm-auth-form register-view__form"
      @submit.prevent="handleRegister"
    >
      <el-form-item label="用户名" prop="username" class="register-view__item">
        <el-input
          v-model="form.username"
          size="large"
          class="fm-input"
          placeholder="设置用户名"
          autocomplete="username"
        />
      </el-form-item>

      <el-form-item label="邮箱" prop="email" class="register-view__item">
        <el-input
          v-model="form.email"
          size="large"
          class="fm-input"
          placeholder="your@email.com"
          autocomplete="email"
        />
      </el-form-item>

      <el-form-item label="密码" prop="password" class="register-view__item">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          size="large"
          class="fm-input"
          placeholder="至少 8 位字符"
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item label="确认密码" prop="confirmPassword" class="register-view__item">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          show-password
          size="large"
          class="fm-input"
          placeholder="再次输入密码"
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item prop="agreed" class="fm-checkbox register-view__agreement">
        <el-checkbox v-model="form.agreed" size="large">我同意服务条款和隐私政策</el-checkbox>
      </el-form-item>

      <el-button
        type="primary"
        size="large"
        class="fm-button-primary register-view__primary"
        :loading="submitting"
        @click="handleRegister"
      >
        注册并开始训练
      </el-button>

      <div class="register-view__footer">
        <span>已有账号？</span>
        <router-link to="/login" class="register-view__footer-link">直接登录</router-link>
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
import { useAuthStore } from '@/store/auth';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreed: boolean;
}

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive<RegisterForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreed: true
});

const validateConfirmPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请再次输入密码'));
    return;
  }

  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'));
    return;
  }

  callback();
};

const validateAgreement = (_rule: unknown, value: boolean, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请先同意服务条款和隐私政策'));
    return;
  }

  callback();
};

const rules: FormRules<RegisterForm> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度为 2 到 20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: ['blur', 'change'] }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度不能少于 8 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: ['blur', 'change'] }
  ],
  agreed: [{ validator: validateAgreement, trigger: 'change' }]
};

const handleRegister = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid || submitting.value) {
    return;
  }

  submitting.value = true;
  try {
    await authStore.register(form.email, form.username, form.password);
    ElMessage.success('注册成功，已自动登录');
    router.push('/');
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败，请稍后再试';
    ElMessage.error(message);
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.register-view__back {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.register-view__back svg {
  width: 18px;
  height: 18px;
}

.register-view__title {
  margin: 0;
  color: var(--color-text-primary);
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: 34px;
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1.08;
}

.register-view__subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 15px;
  line-height: 1.6;
  max-width: 280px;
}

.register-view__form {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px 24px 34px;
  box-sizing: border-box;
}

.register-view__item {
  margin-bottom: 14px;
}

.register-view__agreement {
  margin: 8px 0 10px;
}

.register-view__primary {
  width: 100%;
  height: 54px;
  margin: 4px 0 0;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 700;
}

.register-view__footer {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.register-view__footer-link {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}

@media (max-width: 390px) {
  .register-view__title {
    font-size: 31px;
  }

  .register-view__subtitle {
    font-size: 14px;
  }

  .register-view__form {
    padding: 8px 14px 22px;
  }
}
</style>
