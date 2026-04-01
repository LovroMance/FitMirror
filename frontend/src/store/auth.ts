import { defineStore } from 'pinia';
import { loginApi, meApi, registerApi } from '@/api/auth';
import { syncWorkoutRecordsForUser } from '@/composables/workout/useWorkoutRecordSync';
import type { AuthUser } from '@/types/auth';

const TOKEN_KEY = 'fitmirror_token';

interface AuthState {
  token: string;
  currentUser: AuthUser | null;
  initialized: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    currentUser: null,
    initialized: false
  }),
  getters: {
    isAuthenticated: (state): boolean => Boolean(state.token && state.currentUser)
  },
  actions: {
    setAuth(token: string, user: AuthUser): void {
      this.token = token;
      this.currentUser = user;
      localStorage.setItem(TOKEN_KEY, token);
    },
    clearAuth(): void {
      this.token = '';
      this.currentUser = null;
      localStorage.removeItem(TOKEN_KEY);
    },
    async restoreSession(): Promise<void> {
      if (!this.token) {
        this.initialized = true;
        return;
      }

      try {
        const user = await meApi();
        this.currentUser = user;
        await syncWorkoutRecordsForUser(user.id).catch(() => undefined);
      } catch {
        this.clearAuth();
      } finally {
        this.initialized = true;
      }
    },
    async login(account: string, password: string): Promise<void> {
      const result = await loginApi({ account, password });
      this.setAuth(result.token, result.user);
      await syncWorkoutRecordsForUser(result.user.id).catch(() => undefined);
      this.initialized = true;
    },
    async register(email: string, username: string, password: string): Promise<void> {
      const result = await registerApi({ email, username, password });
      this.setAuth(result.token, result.user);
      await syncWorkoutRecordsForUser(result.user.id).catch(() => undefined);
      this.initialized = true;
    }
  }
});
