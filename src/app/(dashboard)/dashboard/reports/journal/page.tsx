'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function JournalReportPage() {
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const fetchJournals = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/journal?startDate=${period.startDate}&endDate=${period.endDate}`
      );
      const data = await res.json();
      if (data.success) {
        setJournals(data.data.journals);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Jurnal Umum</h1>

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
            <Button onClick={fetchJournals}>Tampilkan</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10">Memuat...</div>
      ) : journals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Tidak ada jurnal pada periode ini
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {journals.map((journal) => (
            <Card key={journal.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {journal.entryNumber} - {formatDate(journal.date, 'long')}
                  </CardTitle>
                  {journal.transactionNumber && (
                    <span className="text-sm text-gray-500">
                      Ref: {journal.transactionNumber}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{journal.description}</p>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Akun</th>
                      <th className="text-right py-2 font-medium w-32">Debit</th>
                      <th className="text-right py-2 font-medium w-32">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.lines.map((line: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2">
                          <span className="font-mono text-gray-500 mr-2">{line.accountCode}</span>
                          {line.accountName}
                        </td>
                        <td className="text-right py-2">
                          {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                        </td>
                        <td className="text-right py-2">
                          {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
