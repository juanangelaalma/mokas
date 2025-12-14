'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const typeLabels: Record<string, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Kewajiban',
  EQUITY: 'Modal',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

const typeColors: Record<string, string> = {
  ASSET: 'text-blue-600 bg-blue-50',
  LIABILITY: 'text-orange-600 bg-orange-50',
  EQUITY: 'text-purple-600 bg-purple-50',
  REVENUE: 'text-green-600 bg-green-50',
  EXPENSE: 'text-red-600 bg-red-50',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

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
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const filteredAccounts = filter === 'ALL' 
    ? accounts 
    : accounts.filter(a => a.type === filter);

  const groupedAccounts = filteredAccounts.reduce((acc, account) => {
    const type = account.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Daftar Akun (Chart of Accounts)</h1>
      </div>

      <div className="flex gap-2">
        {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
          <Button
            key={type}
            variant={filter === type ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter(type)}
          >
            {type === 'ALL' ? 'Semua' : typeLabels[type]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10">Memuat...</div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(groupedAccounts) as [string, any[]][]).map(([type, typeAccounts]) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-sm ${typeColors[type]}`}>
                    {typeLabels[type]}
                  </span>
                  <span className="text-gray-400 text-sm font-normal">
                    ({typeAccounts.length} akun)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Akun</TableHead>
                      <TableHead>Saldo Normal</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeAccounts
                      .sort((a: any, b: any) => a.code.localeCompare(b.code))
                      .map((account: any) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono">{account.code}</TableCell>
                          <TableCell>
                            {account.name}
                            {account.isSystem && (
                              <span className="ml-2 text-xs text-gray-400">(Sistem)</span>
                            )}
                          </TableCell>
                          <TableCell>{account.normalBalance}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              account.isActive 
                                ? 'text-green-600 bg-green-50' 
                                : 'text-gray-500 bg-gray-100'
                            }`}>
                              {account.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
