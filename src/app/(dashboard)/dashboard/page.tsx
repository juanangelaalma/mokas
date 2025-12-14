'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        
        const res = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}&pageSize=5`);
        const data = await res.json();
        
        if (data.success) {
          let totalIncome = 0;
          let totalExpense = 0;
          
          data.data.data.forEach((t: any) => {
            const amount = parseFloat(t.amount);
            if (['CASH_IN', 'BANK_IN', 'RECEIVABLE'].includes(t.type)) {
              totalIncome += amount;
            } else if (['CASH_OUT', 'BANK_OUT', 'PAYABLE'].includes(t.type)) {
              totalExpense += amount;
            }
          });
          
          setSummary({
            totalIncome,
            totalExpense,
            netIncome: totalIncome - totalExpense,
            recentTransactions: data.data.data,
            total: data.data.total,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return <div className="text-center py-10">Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link href="/dashboard/transactions/new">
          <Button>+ Transaksi Baru</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Pemasukan Bulan Ini</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.totalIncome || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Pengeluaran Bulan Ini</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary?.totalExpense || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Laba Bersih Bulan Ini</p>
            <p className={`text-2xl font-bold ${(summary?.netIncome || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(summary?.netIncome || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaksi Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.recentTransactions?.length > 0 ? (
              <div className="space-y-3">
                {summary.recentTransactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{t.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(t.date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <p className={`font-semibold ${
                      ['CASH_IN', 'BANK_IN', 'RECEIVABLE'].includes(t.type) 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {['CASH_IN', 'BANK_IN', 'RECEIVABLE'].includes(t.type) ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Belum ada transaksi</p>
            )}
            <div className="mt-4">
              <Link href="/dashboard/transactions">
                <Button variant="outline" className="w-full">Lihat Semua</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aksi Cepat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/transactions/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                + Catat Pemasukan
              </Button>
            </Link>
            <Link href="/dashboard/transactions/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                - Catat Pengeluaran
              </Button>
            </Link>
            <Link href="/dashboard/reports/profit-loss" className="block">
              <Button variant="outline" className="w-full justify-start">
                Lihat Laba Rugi
              </Button>
            </Link>
            <Link href="/dashboard/reports/balance-sheet" className="block">
              <Button variant="outline" className="w-full justify-start">
                Lihat Neraca
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
