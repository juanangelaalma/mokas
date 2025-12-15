'use client';

import { AIAssistant } from '@/components/ai-assistant';

export default function AIAssistantPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-gray-600 mt-1">
          Tanyakan tentang stok, penjualan, laba rugi, atau produk terlaris
        </p>
      </div>
      <AIAssistant />
    </div>
  );
}

