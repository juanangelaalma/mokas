'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Kontak</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Daftar Pelanggan & Supplier</CardTitle>
        </CardHeader>
        <CardContent className="py-10 text-center text-gray-500">
          Fitur kontak akan tersedia di fase berikutnya.
          <br />
          <span className="text-sm">Untuk saat ini, gunakan fitur transaksi tanpa kontak.</span>
        </CardContent>
      </Card>
    </div>
  );
}
