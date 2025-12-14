'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function TrialBalancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/trial-balance?asOfDate=${asOfDate}`);
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
      <h1 className="text-2xl font-bold text-gray-900">Neraca Saldo (Trial Balance)</h1>

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
      ) : !data?.accounts?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Tidak ada data
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Per {formatDate(asOfDate, 'long')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Akun</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts.map((account: any) => (
                  <TableRow key={account.accountId}>
                    <TableCell className="font-mono">{account.accountCode}</TableCell>
                    <TableCell>{account.accountName}</TableCell>
                    <TableCell className="text-right">
                      {account.debit > 0 ? formatCurrency(account.debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.credit > 0 ? formatCurrency(account.credit) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-gray-50">
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalDebit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalCredit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {Math.abs(data.totalDebit - data.totalCredit) > 0.01 && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                Peringatan: Neraca tidak balance! Selisih: {formatCurrency(Math.abs(data.totalDebit - data.totalCredit))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
