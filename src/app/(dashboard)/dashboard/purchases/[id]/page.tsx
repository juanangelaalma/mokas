'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  UNPAID: 'Belum Dibayar',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
  OVERDUE: 'Jatuh Tempo',
  VOID: 'Batal',
};

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    paymentAccountId: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [purchaseRes, accountsRes] = await Promise.all([
          fetch(`/api/purchases/${params.id}`),
          fetch('/api/accounts?paymentOnly=true'),
        ]);

        const purchaseData = await purchaseRes.json();
        const accountsData = await accountsRes.json();

        if (purchaseData.success) {
          setPurchase(purchaseData.data);
          const remaining = parseFloat(purchaseData.data.totalAmount) - parseFloat(purchaseData.data.paidAmount);
          setPaymentData((prev) => ({ ...prev, amount: remaining.toString() }));
        }
        if (accountsData.success) setPaymentAccounts(accountsData.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentLoading(true);

    try {
      const res = await fetch(`/api/purchases/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentData,
          amount: parseFloat(paymentData.amount),
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.refresh();
        window.location.reload();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Memuat...</div>;
  }

  if (!purchase) {
    return <div className="text-center py-10">Pembelian tidak ditemukan</div>;
  }

  const remaining = parseFloat(purchase.totalAmount) - parseFloat(purchase.paidAmount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{purchase.purchaseNumber}</h1>
          <p className="text-gray-500">{purchase.contact?.name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          purchase.status === 'PAID' ? 'bg-green-50 text-green-600' :
          purchase.status === 'OVERDUE' ? 'bg-red-50 text-red-600' :
          'bg-yellow-50 text-yellow-600'
        }`}>
          {statusLabels[purchase.status]}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{formatCurrency(purchase.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Dibayar</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(purchase.paidAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Sisa</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(remaining)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail Item</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Produk</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Harga Beli</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">{item.product?.name}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.unitCost)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {purchase.payments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Tanggal</th>
                  <th className="px-4 py-2 text-left">No. Payment</th>
                  <th className="px-4 py-2 text-left">Metode</th>
                  <th className="px-4 py-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {purchase.payments.map((payment: any) => (
                  <tr key={payment.id} className="border-t">
                    <td className="px-4 py-2">{formatDate(payment.paymentDate)}</td>
                    <td className="px-4 py-2 font-mono">{payment.paymentNumber}</td>
                    <td className="px-4 py-2">{payment.paymentMethod}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {remaining > 0 && purchase.status !== 'VOID' && (
        <Card>
          <CardHeader>
            <CardTitle>Bayar Hutang</CardTitle>
          </CardHeader>
          <CardContent>
            {!showPaymentForm ? (
              <Button onClick={() => setShowPaymentForm(true)}>+ Bayar Hutang</Button>
            ) : (
              <form onSubmit={handlePayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Tanggal"
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Jumlah"
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    max={remaining}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Metode"
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                    options={[
                      { value: 'CASH', label: 'Tunai' },
                      { value: 'BANK_TRANSFER', label: 'Transfer Bank' },
                    ]}
                  />
                  <Select
                    label="Akun Pembayaran"
                    value={paymentData.paymentAccountId}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentAccountId: e.target.value })}
                    options={paymentAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                    placeholder="Pilih akun"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={paymentLoading}>Simpan Pembayaran</Button>
                  <Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>Batal</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
      </div>
    </div>
  );
}
