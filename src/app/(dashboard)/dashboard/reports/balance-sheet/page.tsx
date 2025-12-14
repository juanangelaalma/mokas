'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function BalanceSheetPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/balance-sheet?asOfDate=${asOfDate}`);
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

  const renderAccountGroup = (title: string, accounts: any[], total: number, color: string) => (
    <div className="mb-6">
      <h3 className={`text-lg font-semibold ${color} mb-3`}>{title}</h3>
      {accounts?.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account: any) => (
            <div key={account.id} className="flex justify-between py-1 border-b">
              <span>
                <span className="font-mono text-gray-500 mr-2">{account.code}</span>
                {account.name}
              </span>
              <span>{formatCurrency(account.balance)}</span>
            </div>
          ))}
          <div className="flex justify-between py-2 font-semibold">
            <span>Total {title}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Tidak ada data</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Neraca (Balance Sheet)</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <Input
              label="Per Tanggal"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
            <Button onClick={fetchData}>Tampilkan</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10">Memuat...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>ASET</CardTitle>
            </CardHeader>
            <CardContent>
              {renderAccountGroup('Aset', data?.assets?.accounts, data?.assets?.total, 'text-blue-600')}
              
              <div className="pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL ASET</span>
                  <span className="text-blue-600">{formatCurrency(data?.assets?.total || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KEWAJIBAN & MODAL</CardTitle>
            </CardHeader>
            <CardContent>
              {renderAccountGroup('Kewajiban', data?.liabilities?.accounts, data?.liabilities?.total, 'text-orange-600')}
              {renderAccountGroup('Modal', data?.equity?.accounts, data?.equity?.total, 'text-purple-600')}
              
              <div className="pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL KEWAJIBAN & MODAL</span>
                  <span className="text-purple-600">{formatCurrency(data?.totalLiabilitiesAndEquity || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {data && Math.abs(data.assets?.total - data.totalLiabilitiesAndEquity) > 0.01 && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          Peringatan: Neraca tidak balance! Aset ({formatCurrency(data.assets?.total)}) != Kewajiban + Modal ({formatCurrency(data.totalLiabilitiesAndEquity)})
        </div>
      )}
    </div>
  );
}
