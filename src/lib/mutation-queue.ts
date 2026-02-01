import { get, set, del } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

// Mutation types for offline queue
export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';

// Pending mutation structure
export interface PendingMutation {
  id: string;
  type: MutationType;
  endpoint: string;
  method: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

// Queue configuration
export interface QueueConfig {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
}

// Default configuration
const DEFAULT_CONFIG: Required<QueueConfig> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  batchSize: 5,
};

// Queue storage keys
const QUEUE_KEY = 'feedly-mutation-queue';
const SYNC_STATUS_KEY = 'feedly-sync-status';

class MutationQueue {
  private config: Required<QueueConfig>;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  constructor(config: QueueConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupOnlineStatusListener();
  }

  // Listen for online/offline status changes
  private setupOnlineStatusListener(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      
      console.debug('[mutation-queue] Initial online status:', this.isOnline);
      
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.debug('[mutation-queue] Back online - triggering sync');
        this.triggerSync();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.debug('[mutation-queue] Went offline');
      });
    }
  }

  // Add a mutation to the queue
  async queueMutation(
    type: MutationType,
    endpoint: string,
    method: string,
    payload: Record<string, unknown>
  ): Promise<string> {
    const mutation: PendingMutation = {
      id: uuidv4(),
      type,
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    };

    const existingQueue = await this.getQueue();
    existingQueue.push(mutation);
    await this.saveQueue(existingQueue);

    // Try to sync immediately if online
    if (this.isOnline) {
      this.triggerSync();
    }

    return mutation.id;
  }

  // Get all pending mutations
  async getQueue(): Promise<PendingMutation[]> {
    const queue = await get<PendingMutation[]>(QUEUE_KEY);
    return queue || [];
  }

  // Get mutations by status
  async getMutationsByStatus(status: PendingMutation['status']): Promise<PendingMutation[]> {
    const queue = await this.getQueue();
    return queue.filter(m => m.status === status);
  }

  // Get count of pending mutations
  async getQueueCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(m => m.status === 'pending').length;
  }

  // Update a mutation in the queue
  private async updateMutation(id: string, updates: Partial<PendingMutation>): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex(m => m.id === id);
    
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await this.saveQueue(queue);
    }
  }

  // Remove a mutation from the queue
  async removeMutation(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(m => m.id !== id);
    await this.saveQueue(filtered);
  }

  // Clear all pending mutations
  async clearQueue(): Promise<void> {
    await del(QUEUE_KEY);
    await del(SYNC_STATUS_KEY);
  }

  // Mark a mutation as syncing
  private async markAsSyncing(id: string): Promise<void> {
    await this.updateMutation(id, { status: 'syncing' });
  }

  // Mark a mutation as failed
  private async markAsFailed(id: string, error: string): Promise<void> {
    const mutation = (await this.getQueue()).find(m => m.id === id);
    if (mutation) {
      const newRetries = mutation.retries + 1;
      
      if (newRetries >= this.config.maxRetries) {
        await this.updateMutation(id, { 
          status: 'failed', 
          error: `Max retries (${this.config.maxRetries}) exceeded: ${error}` 
        });
      } else {
        await this.updateMutation(id, { 
          status: 'pending', 
          retries: newRetries,
          error: undefined 
        });
      }
    }
  }

  // Successfully synced - remove from queue
  private async markAsSynced(id: string): Promise<void> {
    await this.removeMutation(id);
  }

  // Trigger synchronization with the server
  async triggerSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      console.debug('[mutation-queue] Skip sync:', { syncInProgress: this.syncInProgress, isOnline: this.isOnline });
      return;
    }

    this.syncInProgress = true;
    
    try {
      // First, reset any stuck 'syncing' mutations back to 'pending'
      await this.resetStuckMutations();
      
      const pendingMutations = await this.getMutationsByStatus('pending');
      console.debug('[mutation-queue] Pending mutations:', pendingMutations.length);
      
      if (pendingMutations.length === 0) {
        return;
      }

      // Process in batches
      const batch = pendingMutations.slice(0, this.config.batchSize);
      
      for (const mutation of batch) {
        await this.syncMutation(mutation);
      }

      // If more pending, trigger another sync
      const remaining = await this.getQueueCount();
      if (remaining > 0) {
        setTimeout(() => {
          this.syncInProgress = false;
          this.triggerSync();
        }, this.config.retryDelay);
      } else {
        // Update last sync time when queue is empty
        await set(SYNC_STATUS_KEY, { lastSyncTime: Date.now() });
        // Notify listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('sync-mutations'));
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  // Reset stuck 'syncing' mutations back to 'pending'
  private async resetStuckMutations(): Promise<void> {
    const queue = await this.getQueue();
    const stuckMutations = queue.filter(m => m.status === 'syncing');
    
    for (const mutation of stuckMutations) {
      // Reset only if stuck for more than 5 minutes (likely interrupted)
      if (Date.now() - mutation.timestamp > 5 * 60 * 1000) {
        await this.updateMutation(mutation.id, { 
          status: 'pending',
          retries: mutation.retries + 1,
          error: undefined 
        });
      }
    }
  }

  // Sync a single mutation to the server
  private async syncMutation(mutation: PendingMutation): Promise<void> {
    await this.markAsSyncing(mutation.id);
    console.debug('[mutation-queue] Syncing:', mutation.method, mutation.endpoint, mutation.id);

    try {
      const response = await fetch(mutation.endpoint, {
        method: mutation.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mutation.payload),
      });

      console.debug('[mutation-queue] Response:', mutation.endpoint, response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await this.markAsSynced(mutation.id);
      console.debug('[mutation-queue] Synced successfully:', mutation.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.debug('[mutation-queue] Sync failed:', mutation.id, errorMessage);
      await this.markAsFailed(mutation.id, errorMessage);
    }
  }

  // Save queue to IndexedDB
  private async saveQueue(queue: PendingMutation[]): Promise<void> {
    await set(QUEUE_KEY, queue);
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    isOnline: boolean;
    lastSyncTime?: number;
  }> {
    const queue = await this.getQueue();
    const syncStatus = await get<{ lastSyncTime: number }>(SYNC_STATUS_KEY);

    return {
      pending: queue.filter(m => m.status === 'pending').length,
      syncing: queue.filter(m => m.status === 'syncing').length,
      failed: queue.filter(m => m.status === 'failed').length,
      isOnline: this.isOnline,
      lastSyncTime: syncStatus?.lastSyncTime,
    };
  }

  // Get current online status
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Retry failed mutations
  async retryFailedMutations(): Promise<void> {
    const queue = await this.getQueue();
    const failedMutations = queue.filter(m => m.status === 'failed');
    
    for (const mutation of failedMutations) {
      await this.updateMutation(mutation.id, { 
        status: 'pending', 
        retries: 0,
        error: undefined 
      });
    }

    this.triggerSync();
  }
}

// Export singleton instance
export const mutationQueue = new MutationQueue();

// Export helper functions for common operations
export async function queueCreate(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<string> {
  return mutationQueue.queueMutation('CREATE', endpoint, 'POST', payload);
}

export async function queueUpdate(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<string> {
  return mutationQueue.queueMutation('UPDATE', endpoint, 'PUT', payload);
}

export async function queueDelete(endpoint: string): Promise<string> {
  return mutationQueue.queueMutation('DELETE', endpoint, 'DELETE', {});
}

export { MutationQueue };
