"use client";

import { useSession } from 'next-auth/react';
import SettingsForm from './components/SettingsForm';
import { ROLES } from '@/lib/constants';
import { UnauthorizedView } from '@/components/ui/unauthorized-view';

export default function SettingsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role?.toUpperCase();
  
  // Only Owner can access settings
  if (userRole && userRole !== ROLES.OWNER) {
    return <UnauthorizedView />;
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Pengaturan Toko</h2>
      </div>
      <div className="h-full flex-1 flex-col space-y-8 flex">
        <SettingsForm />
      </div>
    </div>
  );
}
