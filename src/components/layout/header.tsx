'use client';

import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {session?.user?.tenantName || 'Dashboard'}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session?.user?.name}</span>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
            Keluar
          </Button>
        </div>
      </div>
    </header>
  );
}
