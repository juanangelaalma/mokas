'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    type: 'INVENTORY',
    unit: 'pcs',
    purchasePrice: '',
    sellingPrice: '',
    minStock: '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          purchasePrice: parseFloat(formData.purchasePrice) || 0,
          sellingPrice: parseFloat(formData.sellingPrice) || 0,
          minStock: parseInt(formData.minStock) || 0,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
      } else {
        router.push('/dashboard/products');
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tambah Produk Baru</h1>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Produk</CardTitle>
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
                label="SKU"
                placeholder="Kode produk unik"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />

              <Select
                label="Tipe Produk"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={[
                  { value: 'INVENTORY', label: 'Barang (Inventory)' },
                  { value: 'SERVICE', label: 'Jasa (Service)' },
                ]}
              />
            </div>

            <Input
              label="Nama Produk"
              placeholder="Nama produk"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Deskripsi"
              placeholder="Deskripsi produk (opsional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Satuan"
                placeholder="pcs, kg, liter, dll"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />

              {formData.type === 'INVENTORY' && (
                <Input
                  label="Stok Minimum"
                  type="number"
                  placeholder="0"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Harga Beli (Rp)"
                type="number"
                placeholder="0"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                required
              />

              <Input
                label="Harga Jual (Rp)"
                type="number"
                placeholder="0"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" loading={loading}>
                Simpan
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
