import { fitMirrorDb } from '@/db';
import type { UserSettingsEntity } from '@/types/local-db';

const toRepositoryError = (action: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`[settingsRepository] ${action} failed: ${message}`);
};

export const settingsRepository = {
  async upsertSettings(payload: UserSettingsEntity): Promise<UserSettingsEntity> {
    try {
      await fitMirrorDb.settings.put(payload);
      return payload;
    } catch (error) {
      throw toRepositoryError('upsertSettings', error);
    }
  },

  async getSettingsByUser(userId: number): Promise<UserSettingsEntity | null> {
    try {
      const settings = await fitMirrorDb.settings.get(userId);
      return settings ?? null;
    } catch (error) {
      throw toRepositoryError('getSettingsByUser', error);
    }
  }
};
