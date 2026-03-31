import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/store/auth';

interface LoginForm {
  account: string;
  password: string;
}

export const useLoginForm = () => {
  const router = useRouter();
  const authStore = useAuthStore();
  const formRef = ref<FormInstance>();
  const submitting = ref(false);

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
    if (!valid || submitting.value) {
      return;
    }

    submitting.value = true;
    try {
      await authStore.login(form.account, form.password);
      ElMessage.success('登录成功');
      await router.push('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败，请稍后再试';
      ElMessage.error(message);
    } finally {
      submitting.value = false;
    }
  };

  return {
    form,
    formRef,
    handleLogin,
    rules,
    submitting
  };
};
