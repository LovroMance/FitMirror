import { computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

export const useProfilePage = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const currentUser = computed(() => authStore.currentUser);

  const quickActions = [
    {
      title: '训练记录',
      description: '查看最近打卡、热图和趋势摘要。',
      actionLabel: '查看记录',
      action: async () => {
        await router.push({ name: 'WorkoutLog' });
      }
    },
    {
      title: '历史计划',
      description: '回看最近生成和保存过的训练计划。',
      actionLabel: '查看计划',
      action: async () => {
        await router.push({ name: 'PlanHistory' });
      }
    },
    {
      title: '饮食计划',
      description: '继续生成或调整今天的饮食安排。',
      actionLabel: '去饮食页',
      action: async () => {
        await router.push({ name: 'Nutrition' });
      }
    }
  ];

  const handleLogout = async (): Promise<void> => {
    try {
      await ElMessageBox.confirm('退出后需要重新登录才能继续同步数据，确定要退出吗？', '退出登录', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning'
      });
    } catch {
      return;
    }

    authStore.clearAuth();
    ElMessage.success('已退出登录');
    await router.push({ name: 'Login' });
  };

  return {
    currentUser,
    handleLogout,
    quickActions
  };
};
