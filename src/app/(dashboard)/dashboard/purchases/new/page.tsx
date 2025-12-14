'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  amount: number;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    contactId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    paymentType: 'CREDIT',
    paymentAccountId: '',
    notes: '',
  });

  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: 1,
    unitCost: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vendorsRes, productsRes, accountsRes] = await Promise.all([
          fetch('/api/contacts?type=VENDOR'),
          fetch('/api/products?type=INVENTORY'),
          fetch('/api/accounts?paymentOnly=true'),
        ]);

        const vendorsData = await vendorsRes.json();
        const productsData = await productsRes.json();
        const accountsData = await accountsRes.json();

        if (vendorsData.success) setVendors(vendorsData.data);
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
        unitCost: parseFloat(product.purchasePrice),
      });
    }
  };

  const addItem = () => {
    if (!newItem.productId || newItem.quantity <= 0 || newItem.unitCost <= 0) {
      return;
    }

    const product = products.find((p) => p.id === newItem.productId);
    const amount = newItem.quantity * newItem.unitCost;

    setItems([
      ...items,
      {
        productId: newItem.productId,
        productName: product?.name || '',
        quantity: newItem.quantity,
        unitCost: newItem.unitCost,
        amount,
      },
    ]);

    setNewItem({
      productId: '',
      quantity: 1,
      unitCost: 0,
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
      setError('Pilih akun pembayaran untuk pembelian tunai');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log("FORM DATA", formData);
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
      } else {
        router.push('/dashboard/purchases');
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Buat Pembelian Baru</h1>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Pembelian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Supplier"
                  value={formData.contactId}
                  onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                  options={vendors.map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }))}
                  placeholder="Pilih supplier"
                />

                <Input
                  label="Tanggal"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
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
              <CardTitle>Item Pembelian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select
                      label="Produk"
                      value={newItem.productId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      options={products.map((p) => ({
                        value: p.id,
                        label: `${p.sku} - ${p.name}`,
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
                  <div className="col-span-3">
                    <Input
                      label="Harga Beli"
                      type="number"
                      min="0"
                      value={newItem.unitCost}
                      onChange={(e) => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) || 0 })}
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
                          <th className="px-4 py-2 text-right">Harga Beli</th>
                          <th className="px-4 py-2 text-right">Subtotal</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2">{item.productName}</td>
                            <td className="px-4 py-2 text-right">{item.quantity}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(item.unitCost)}</td>
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
                          <td colSpan={3} className="px-4 py-2 text-right">
                            Total
                          </td>
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
              Simpan Pembelian
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
