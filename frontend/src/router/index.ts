import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/home/HomePage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/plans/generate',
    name: 'PlanGenerator',
    component: () => import('@/views/plan/PlanGeneratorPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/plans/history',
    name: 'PlanHistory',
    component: () => import('@/views/plan/PlanHistoryPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/records',
    name: 'WorkoutLog',
    component: () => import('@/views/workout/WorkoutLogPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/nutrition',
    name: 'Nutrition',
    component: () => import('@/views/nutrition/NutritionPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/profile/ProfilePage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/workouts/session',
    name: 'WorkoutSession',
    component: () => import('@/views/workout/WorkoutSessionPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/exercises',
    name: 'Exercises',
    component: () => import('@/views/exercises/ExercisesPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegistrationPage.vue'),
    meta: { guestOnly: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.initialized) {
    await authStore.restoreSession();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'Home' };
  }

  return true;
});

export default router;
