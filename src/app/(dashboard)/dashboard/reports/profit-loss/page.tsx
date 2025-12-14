'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ProfitLossPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/profit-loss?startDate=${period.startDate}&endDate=${period.endDate}`
      );
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Laporan Laba Rugi</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <Input
              label="Dari Tanggal"
              type="date"
              value={period.startDate}
              onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
            />
            <Input
              label="Sampai Tanggal"
              type="date"
              value={period.endDate}
              onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
            />
            <Button onClick={fetchData}>Tampilkan</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10">Memuat...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Periode: {formatDate(period.startDate, 'long')} - {formatDate(period.endDate, 'long')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-3">PENDAPATAN</h3>
              {data?.revenue?.accounts?.length > 0 ? (
                <div className="space-y-2">
                  {data.revenue.accounts.map((account: any) => (
                    <div key={account.id} className="flex justify-between py-1 border-b">
                      <span>
                        <span className="font-mono text-gray-500 mr-2">{account.code}</span>
                        {account.name}
                      </span>
                      <span>{formatCurrency(account.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold">
                    <span>Total Pendapatan</span>
                    <span className="text-green-600">{formatCurrency(data.revenue.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Tidak ada pendapatan</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-red-600 mb-3">BEBAN</h3>
              {data?.expenses?.accounts?.length > 0 ? (
                <div className="space-y-2">
                  {data.expenses.accounts.map((account: any) => (
                    <div key={account.id} className="flex justify-between py-1 border-b">
                      <span>
                        <span className="font-mono text-gray-500 mr-2">{account.code}</span>
                        {account.name}
                      </span>
                      <span>{formatCurrency(account.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold">
                    <span>Total Beban</span>
                    <span className="text-red-600">{formatCurrency(data.expenses.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Tidak ada beban</p>
              )}
            </div>

            <div className="pt-4 border-t-2 border-gray-300">
              <div className="flex justify-between text-xl font-bold">
                <span>{data?.netIncome >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</span>
                <span className={data?.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(Math.abs(data?.netIncome || 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
