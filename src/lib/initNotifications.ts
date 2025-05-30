'use server';

import { initializeNotificationService } from './notificationService';

// Inisialisasi layanan notifikasi saat aplikasi dimulai
export async function initializeNotifications() {
  try {
    await initializeNotificationService();
    return { success: true };
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return { success: false, error: (error as Error).message };
  }
} 