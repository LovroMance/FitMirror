import { fitMirrorDb } from '@/db';
import type { ExercisePreferenceEntity } from '@/types/local-db';

const RECENT_VIEW_LIMIT = 10;

const toRepositoryError = (action: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`[exercisePreferencesRepository] ${action} failed: ${message}`);
};

const removeIfEmpty = async (entity: ExercisePreferenceEntity): Promise<void> => {
  if (!entity.id) {
    return;
  }

  if (!entity.isFavorite && !entity.lastViewedAt) {
    await fitMirrorDb.exercisePreferences.delete(entity.id);
  }
};

export const exercisePreferencesRepository = {
  async listPreferencesByUser(userId: number): Promise<ExercisePreferenceEntity[]> {
    try {
      return await fitMirrorDb.exercisePreferences.where('userId').equals(userId).toArray();
    } catch (error) {
      throw toRepositoryError('listPreferencesByUser', error);
    }
  },

  async toggleFavorite(userId: number, exerciseId: string): Promise<ExercisePreferenceEntity> {
    try {
      const existing = await fitMirrorDb.exercisePreferences
        .where('[userId+exerciseId]')
        .equals([userId, exerciseId])
        .first();
      const timestamp = new Date().toISOString();

      if (!existing) {
        const entity: Omit<ExercisePreferenceEntity, 'id'> = {
          userId,
          exerciseId,
          isFavorite: true,
          updatedAt: timestamp
        };
        const id = await fitMirrorDb.exercisePreferences.add(entity);
        return { ...entity, id: Number(id) };
      }

      const updated: ExercisePreferenceEntity = {
        ...existing,
        isFavorite: !existing.isFavorite,
        updatedAt: timestamp
      };

      await fitMirrorDb.exercisePreferences.put(updated);
      await removeIfEmpty(updated);
      return updated;
    } catch (error) {
      throw toRepositoryError('toggleFavorite', error);
    }
  },

  async touchRecentlyViewed(userId: number, exerciseId: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const existing = await fitMirrorDb.exercisePreferences
        .where('[userId+exerciseId]')
        .equals([userId, exerciseId])
        .first();

      if (!existing) {
        await fitMirrorDb.exercisePreferences.add({
          userId,
          exerciseId,
          isFavorite: false,
          lastViewedAt: timestamp,
          updatedAt: timestamp
        });
      } else {
        await fitMirrorDb.exercisePreferences.put({
          ...existing,
          lastViewedAt: timestamp,
          updatedAt: timestamp
        });
      }

      const recent = await fitMirrorDb.exercisePreferences.where('userId').equals(userId).toArray();
      const overflow = recent
        .filter((item) => item.lastViewedAt)
        .sort((a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''))
        .slice(RECENT_VIEW_LIMIT);

      for (const item of overflow) {
        const updated: ExercisePreferenceEntity = {
          ...item,
          lastViewedAt: undefined,
          updatedAt: timestamp
        };
        await fitMirrorDb.exercisePreferences.put(updated);
        await removeIfEmpty(updated);
      }
    } catch (error) {
      throw toRepositoryError('touchRecentlyViewed', error);
    }
  },

  async listFavoritesByUser(userId: number): Promise<ExercisePreferenceEntity[]> {
    try {
      const items = await fitMirrorDb.exercisePreferences.where('userId').equals(userId).toArray();
      return items.filter((item) => item.isFavorite).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) {
      throw toRepositoryError('listFavoritesByUser', error);
    }
  },

  async listRecentViewedByUser(userId: number): Promise<ExercisePreferenceEntity[]> {
    try {
      const items = await fitMirrorDb.exercisePreferences.where('userId').equals(userId).toArray();
      return items
        .filter((item) => Boolean(item.lastViewedAt))
        .sort((a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''));
    } catch (error) {
      throw toRepositoryError('listRecentViewedByUser', error);
    }
  }
};
