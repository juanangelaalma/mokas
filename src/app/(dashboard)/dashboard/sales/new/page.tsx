'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  amount: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    contactId: '',
    saleDate: new Date().toISOString().split('T')[0],
    paymentType: 'CREDIT',
    paymentAccountId: '',
    notes: '',
  });
  
  const [items, setItems] = useState<SaleItem[]>([]);
  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customersRes, productsRes, accountsRes] = await Promise.all([
          fetch('/api/contacts?type=CUSTOMER'),
          fetch('/api/products'),
          fetch('/api/accounts?paymentOnly=true'),
        ]);

        const customersData = await customersRes.json();
        const productsData = await productsRes.json();
        const accountsData = await accountsRes.json();

        if (customersData.success) setCustomers(customersData.data);
        if (productsData.success) setProducts(productsData.data);
        if (accountsData.success) setPaymentAccounts(accountsData.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, []);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        productId,
        unitPrice: parseFloat(product.sellingPrice),
      });
    }
  };

  const addItem = () => {
    if (!newItem.productId || newItem.quantity <= 0 || newItem.unitPrice <= 0) {
      return;
    }

    const product = products.find((p) => p.id === newItem.productId);
    const amount = newItem.quantity * newItem.unitPrice * (1 - newItem.discountPercent / 100);

    setItems([
      ...items,
      {
        productId: newItem.productId,
        productName: product?.name || '',
        quantity: newItem.quantity,
        unitPrice: newItem.unitPrice,
        discountPercent: newItem.discountPercent,
        amount,
      },
    ]);

    setNewItem({
      productId: '',
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
    });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      setError('Tambahkan minimal 1 item');
      return;
    }

    if (formData.paymentType === 'CASH' && !formData.paymentAccountId) {
      setError('Pilih akun pembayaran untuk penjualan tunai');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
          })),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
      } else {
        router.push('/dashboard/sales');
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Buat Penjualan Baru</h1>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Penjualan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Pelanggan"
                  value={formData.contactId}
                  onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                  options={customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                  placeholder="Pilih pelanggan"
                />

                <Input
                  label="Tanggal"
                  type="date"
                  value={formData.saleDate}
                  onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Tipe Pembayaran"
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                  options={[
                    { value: 'CREDIT', label: 'Kredit (Bayar Nanti)' },
                    { value: 'CASH', label: 'Tunai (Bayar Sekarang)' },
                  ]}
                />

                {formData.paymentType === 'CASH' && (
                  <Select
                    label="Akun Pembayaran"
                    value={formData.paymentAccountId}
                    onChange={(e) => setFormData({ ...formData, paymentAccountId: e.target.value })}
                    options={paymentAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                    placeholder="Pilih akun"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Item Penjualan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Select
                      label="Produk"
                      value={newItem.productId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      options={products.map((p) => ({ 
                        value: p.id, 
                        label: `${p.sku} - ${p.name} ${p.currentStock !== null ? `(Stok: ${p.currentStock})` : ''}` 
                      }))}
                      placeholder="Pilih produk"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Qty"
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Harga"
                      type="number"
                      min="0"
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Disc %"
                      type="number"
                      min="0"
                      max="100"
                      value={newItem.discountPercent}
                      onChange={(e) => setNewItem({ ...newItem, discountPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Button type="button" onClick={addItem} className="w-full">
                      Tambah
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Produk</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Harga</th>
                          <th className="px-4 py-2 text-right">Disc</th>
                          <th className="px-4 py-2 text-right">Subtotal</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2">{item.productName}</td>
                            <td className="px-4 py-2 text-right">{item.quantity}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-4 py-2 text-right">{item.discountPercent}%</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-medium">
                        <tr className="border-t">
                          <td colSpan={4} className="px-4 py-2 text-right">Total</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(total)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Input
                label="Catatan"
                placeholder="Catatan tambahan (opsional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" loading={loading} disabled={items.length === 0}>
              Simpan Penjualan
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Batal
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
