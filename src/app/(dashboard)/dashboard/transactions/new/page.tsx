'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TransactionType } from '@prisma/client';

const transactionTypes = [
  { value: 'CASH_IN', label: 'Pemasukan Tunai', category: 'income' },
  { value: 'BANK_IN', label: 'Pemasukan Bank', category: 'income' },
  { value: 'CASH_OUT', label: 'Pengeluaran Tunai', category: 'expense' },
  { value: 'BANK_OUT', label: 'Pengeluaran Bank', category: 'expense' },
  { value: 'TRANSFER', label: 'Transfer Antar Kas/Bank', category: 'transfer' },
];

export default function NewTransactionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'CASH_IN' as TransactionType,
    description: '',
    amount: '',
    paymentAccountId: '',
    categoryAccountId: '',
    notes: '',
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const [allRes, paymentRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/accounts?paymentOnly=true'),
        ]);
        
        const allData = await allRes.json();
        const paymentData = await paymentRes.json();
        
        if (allData.success) setAccounts(allData.data);
        if (paymentData.success) setPaymentAccounts(paymentData.data);
        
        if (paymentData.data?.length > 0) {
          setFormData(prev => ({ ...prev, paymentAccountId: paymentData.data[0].id }));
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchAccounts();
  }, []);

  const getCategoryAccounts = () => {
    const type = formData.type;
    if (['CASH_IN', 'BANK_IN'].includes(type)) {
      return accounts.filter(a => a.type === 'REVENUE');
    }
    if (['CASH_OUT', 'BANK_OUT'].includes(type)) {
      return accounts.filter(a => a.type === 'EXPENSE');
    }
    if (type === 'TRANSFER') {
      return paymentAccounts.filter(a => a.id !== formData.paymentAccountId);
    }
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
      } else {
        router.push('/dashboard/transactions');
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transaksi Baru</h1>

      <Card>
        <CardHeader>
          <CardTitle>Input Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tanggal"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />

              <Select
                label="Tipe Transaksi"
                value={formData.type}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  type: e.target.value as TransactionType,
                  categoryAccountId: '',
                })}
                options={transactionTypes.map(t => ({ value: t.value, label: t.label }))}
                required
              />
            </div>

            <Input
              label="Deskripsi"
              placeholder="Contoh: Penjualan barang dagangan"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />

            <Input
              label="Jumlah (Rp)"
              type="number"
              placeholder="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              min="1"
            />

            <Select
              label="Akun Kas/Bank"
              value={formData.paymentAccountId}
              onChange={(e) => setFormData({ ...formData, paymentAccountId: e.target.value })}
              options={paymentAccounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
              placeholder="Pilih akun kas/bank"
              required
            />

            <Select
              label={formData.type === 'TRANSFER' ? 'Akun Tujuan' : 'Akun Kategori'}
              value={formData.categoryAccountId}
              onChange={(e) => setFormData({ ...formData, categoryAccountId: e.target.value })}
              options={getCategoryAccounts().map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
              placeholder="Pilih akun"
              required
            />

            <Input
              label="Catatan (opsional)"
              placeholder="Catatan tambahan"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="flex gap-4 pt-4">
              <Button type="submit" loading={loading}>
                Simpan Transaksi
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
