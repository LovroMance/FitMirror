import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/store/auth';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreed: boolean;
}

export const useRegistrationForm = () => {
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
      { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 8, message: '密码长度不能少于 8 位', trigger: 'blur' }
    ],
    confirmPassword: [
      { required: true, message: '请再次输入密码', trigger: 'blur' },
      { validator: validateConfirmPassword, trigger: 'blur' }
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
      await router.push('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败，请稍后再试';
      ElMessage.error(message);
    } finally {
      submitting.value = false;
    }
  };

  return {
    form,
    formRef,
    handleRegister,
    rules,
    submitting
  };
};
