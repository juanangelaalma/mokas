'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  UNPAID: 'Belum Dibayar',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
  OVERDUE: 'Jatuh Tempo',
  VOID: 'Batal',
};

const statusColors: Record<string, string> = {
  UNPAID: 'bg-yellow-50 text-yellow-600',
  PARTIAL: 'bg-blue-50 text-blue-600',
  PAID: 'bg-green-50 text-green-600',
  OVERDUE: 'bg-red-50 text-red-600',
  VOID: 'bg-gray-100 text-gray-500',
};

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const fetchSales = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?page=${page}&pageSize=20`);
      const data = await res.json();
      if (data.success) {
        setSales(data.data.data);
        setPagination({
          page: data.data.page,
          totalPages: data.data.totalPages,
          total: data.data.total,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Penjualan</h1>
        <Link href="/dashboard/sales/new">
          <Button>+ Buat Penjualan</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Penjualan</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">Memuat...</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Belum ada penjualan.{' '}
              <Link href="/dashboard/sales/new" className="text-primary-600 hover:underline">
                Buat penjualan pertama
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Dibayar</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.saleDate)}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/sales/${sale.id}`} className="text-primary-600 hover:underline font-mono">
                          {sale.saleNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{sale.contact?.name}</TableCell>
                      <TableCell>{formatDate(sale.dueDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(sale.paidAmount)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[sale.status]}`}>
                          {statusLabels[sale.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  Menampilkan {sales.length} dari {pagination.total} penjualan
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchSales(pagination.page - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchSales(pagination.page + 1)}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
