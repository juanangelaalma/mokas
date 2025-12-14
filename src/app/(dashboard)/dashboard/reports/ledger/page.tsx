'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function LedgerPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        if (data.success) {
          setAccounts(data.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAccounts();
  }, []);

  const fetchLedger = async () => {
    if (!selectedAccount) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/ledger/${selectedAccount}?startDate=${period.startDate}&endDate=${period.endDate}`
      );
      const data = await res.json();
      if (data.success) {
        setLedger(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Buku Besar (Ledger)</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-4 gap-4 items-end">
            <Select
              label="Pilih Akun"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              options={accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
              placeholder="Pilih akun"
            />
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
            <Button onClick={fetchLedger} disabled={!selectedAccount}>
              Tampilkan
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10">Memuat...</div>
      ) : ledger ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {ledger.account.code} - {ledger.account.name}
            </CardTitle>
            <p className="text-sm text-gray-500">
              Periode: {formatDate(period.startDate, 'long')} - {formatDate(period.endDate, 'long')}
            </p>
          </CardHeader>
          <CardContent>
            {ledger.entries?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>No. Jurnal</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Kredit</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.entries.map((entry: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.journalNumber}</TableCell>
                      <TableCell className="text-right">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-10">
                Tidak ada transaksi pada periode ini
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Pilih akun dan klik Tampilkan untuk melihat buku besar
          </CardContent>
        </Card>
      )}
    </div>
  );
}
