const STORAGE_KEY_PREFIX = 'fitmirror_pending_deleted_plan_ids_';

const getStorageKey = (userId: number): string => `${STORAGE_KEY_PREFIX}${userId}`;

const parseDeletedIds = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [];
  }
};

export const planSyncStateRepository = {
  async listPendingDeletedPlanIds(userId: number): Promise<string[]> {
    return parseDeletedIds(localStorage.getItem(getStorageKey(userId)));
  },

  async markPlanDeleted(userId: number, clientPlanId: string): Promise<void> {
    const current = await this.listPendingDeletedPlanIds(userId);
    if (current.includes(clientPlanId)) {
      return;
    }

    localStorage.setItem(getStorageKey(userId), JSON.stringify([...current, clientPlanId]));
  },

  async clearPendingDeletedPlanIds(userId: number, deletedClientPlanIds: string[]): Promise<void> {
    if (deletedClientPlanIds.length === 0) {
      return;
    }

    const remaining = (await this.listPendingDeletedPlanIds(userId)).filter((id) => !deletedClientPlanIds.includes(id));
    if (remaining.length === 0) {
      localStorage.removeItem(getStorageKey(userId));
      return;
    }

    localStorage.setItem(getStorageKey(userId), JSON.stringify(remaining));
  }
};
