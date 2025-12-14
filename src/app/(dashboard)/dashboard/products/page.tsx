'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = filter === 'ALL' ? '/api/products' : `/api/products?type=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
        <Link href="/dashboard/products/new">
          <Button>+ Tambah Produk</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {['ALL', 'INVENTORY', 'SERVICE'].map((type) => (
          <Button
            key={type}
            variant={filter === type ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter(type)}
          >
            {type === 'ALL' ? 'Semua' : type === 'INVENTORY' ? 'Barang' : 'Jasa'}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">Memuat...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Belum ada produk.{' '}
              <Link href="/dashboard/products/new" className="text-primary-600 hover:underline">
                Tambah produk pertama
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Harga Beli</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Nilai Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/products/${product.id}`} className="text-primary-600 hover:underline">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        product.type === 'INVENTORY' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {product.type === 'INVENTORY' ? 'Barang' : 'Jasa'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(product.purchasePrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.sellingPrice)}</TableCell>
                    <TableCell className="text-right">
                      {product.currentStock !== null ? (
                        <span className={product.currentStock <= product.minStock ? 'text-red-600 font-medium' : ''}>
                          {product.currentStock} {product.unit}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.stockValue !== null ? formatCurrency(product.stockValue) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
