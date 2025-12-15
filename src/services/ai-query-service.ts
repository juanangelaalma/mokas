import { productService } from './product-service';
import { saleService } from './sale-service';
import { reportService } from './report-service';

export interface AIQueryRequest {
  query: string;
  tool?: string;
  parameters?: Record<string, any>;
}

export interface AIQueryResponse {
  tool: string;
  data: any;
  message: string;
}

export class AIQueryService {
  /**
   * Parse user query dan tentukan tool yang sesuai
   */
  async processQuery(tenantId: string, userQuery: string): Promise<AIQueryResponse> {
    const query = userQuery.toLowerCase().trim();

    // 1. Query Inventory
    if (this.isInventoryQuery(query)) {
      return await this.handleInventoryQuery(tenantId, query);
    }

    // 2. Query Sales Summary
    if (this.isSalesSummaryQuery(query)) {
      return await this.handleSalesSummaryQuery(tenantId, query);
    }

    // 3. Query Top Products
    if (this.isTopProductsQuery(query)) {
      return await this.handleTopProductsQuery(tenantId, query);
    }

    // 4. Query Profit Loss
    if (this.isProfitLossQuery(query)) {
      return await this.handleProfitLossQuery(tenantId, query);
    }

    // 5. Query Trend Analysis
    if (this.isTrendQuery(query)) {
      return await this.handleTrendQuery(tenantId, query);
    }

    // Default: tidak bisa dipahami
    return {
      tool: 'unknown',
      data: null,
      message: 'Maaf, saya belum memahami pertanyaan Anda. Silakan coba dengan format yang lebih spesifik.',
    };
  }

  // ============================================
  // QUERY DETECTION
  // ============================================

  private isInventoryQuery(query: string): boolean {
    const patterns = [
      /stok|inventory|persediaan|sisa.*barang|barang.*berapa/,
      /produk.*stok|stok.*produk/,
    ];
    return patterns.some((p) => p.test(query));
  }

  private isSalesSummaryQuery(query: string): boolean {
    const patterns = [
      /omzet|penjualan.*total|total.*penjualan|revenue|pendapatan/,
      /penjualan.*minggu|penjualan.*bulan|penjualan.*hari/,
    ];
    return patterns.some((p) => p.test(query));
  }

  private isTopProductsQuery(query: string): boolean {
    const patterns = [
      /produk.*tertinggi|produk.*terlaris|top.*produk|produk.*paling/,
      /penjualan.*tertinggi|penjualan.*terlaris/,
    ];
    return patterns.some((p) => p.test(query));
  }

  private isProfitLossQuery(query: string): boolean {
    const patterns = [
      /laba|rugi|profit|loss|keuntungan|kerugian/,
      /kenapa.*laba.*turun|kenapa.*profit.*turun|mengapa.*laba/,
    ];
    return patterns.some((p) => p.test(query));
  }

  private isTrendQuery(query: string): boolean {
    const patterns = [
      /trend|tren|perkembangan|perubahan/,
      /naik|turun|meningkat|menurun/,
    ];
    return patterns.some((p) => p.test(query));
  }

  // ============================================
  // QUERY HANDLERS
  // ============================================

  private async handleInventoryQuery(tenantId: string, query: string): Promise<AIQueryResponse> {
    // Extract product name if mentioned
    const productMatch = query.match(/(?:produk|barang)\s+([a-zA-Z0-9\s]+)/i);
    const productName = productMatch ? productMatch[1].trim() : null;

    const products = await productService.getAll(tenantId);
    
    if (productName) {
      const product = products.find(
        (p) => p.name.toLowerCase().includes(productName.toLowerCase()) ||
               p.sku.toLowerCase().includes(productName.toLowerCase())
      );
      
      if (!product) {
        return {
          tool: 'get_inventory',
          data: null,
          message: `Produk "${productName}" tidak ditemukan.`,
        };
      }

      if (product.type === 'SERVICE') {
        return {
          tool: 'get_inventory',
          data: product,
          message: `Produk "${product.name}" adalah layanan (service), tidak memiliki stok.`,
        };
      }

      return {
        tool: 'get_inventory',
        data: product,
        message: `Stok produk "${product.name}" saat ini: ${product.currentStock} ${product.unit}. Nilai stok: Rp ${product.stockValue?.toLocaleString('id-ID') || 0}.`,
      };
    }

    // Return all inventory products
    const inventoryProducts = products.filter((p) => p.type === 'INVENTORY' && p.currentStock !== null);
    
    if (inventoryProducts.length === 0) {
      return {
        tool: 'get_inventory',
        data: [],
        message: 'Tidak ada produk inventory yang tersedia.',
      };
    }

    const lowStockProducts = inventoryProducts.filter(
      (p) => p.minStock && p.currentStock! <= p.minStock
    );

    let message = `Total ${inventoryProducts.length} produk inventory:\n\n`;
    inventoryProducts.slice(0, 10).forEach((p) => {
      message += `• ${p.name}: ${p.currentStock} ${p.unit}\n`;
    });

    if (lowStockProducts.length > 0) {
      message += `\n⚠️ Peringatan: ${lowStockProducts.length} produk dengan stok rendah.`;
    }

    return {
      tool: 'get_inventory',
      data: inventoryProducts,
      message,
    };
  }

  private async handleSalesSummaryQuery(tenantId: string, query: string): Promise<AIQueryResponse> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    // Parse date range
    if (query.includes('minggu lalu') || query.includes('week')) {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      startDate = new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (query.includes('bulan ini') || query.includes('this month')) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (query.includes('bulan lalu') || query.includes('last month')) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      // Default: bulan ini
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const sales = await saleService.getAll(tenantId, {
      startDate,
      endDate,
      pageSize: 1000,
    });

    const totalSales = sales.data.reduce((sum: number, sale: any) => {
      return sum + parseFloat(sale.totalAmount.toString());
    }, 0);

    const paidSales = sales.data.filter((s: any) => s.status === 'PAID');
    const unpaidSales = sales.data.filter((s: any) => s.status === 'UNPAID');

    const totalPaid = paidSales.reduce((sum: number, sale: any) => {
      return sum + parseFloat(sale.totalAmount.toString());
    }, 0);

    const totalUnpaid = unpaidSales.reduce((sum: number, sale: any) => {
      return sum + parseFloat(sale.totalAmount.toString());
    }, 0);

    const period = this.formatDateRange(startDate, endDate);
    let message = `📊 Ringkasan Penjualan (${period}):\n\n`;
    message += `• Total Omzet: Rp ${totalSales.toLocaleString('id-ID')}\n`;
    message += `• Sudah Dibayar: Rp ${totalPaid.toLocaleString('id-ID')}\n`;
    message += `• Belum Dibayar: Rp ${totalUnpaid.toLocaleString('id-ID')}\n`;
    message += `• Jumlah Transaksi: ${sales.total} penjualan`;

    return {
      tool: 'get_sales_summary',
      data: {
        period: { start: startDate, end: endDate },
        totalSales,
        totalPaid,
        totalUnpaid,
        transactionCount: sales.total,
      },
      message,
    };
  }

  private async handleTopProductsQuery(tenantId: string, query: string): Promise<AIQueryResponse> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let limit = 5;

    // Parse period
    if (query.includes('bulan ini') || query.includes('this month')) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (query.includes('bulan lalu') || query.includes('last month')) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (query.includes('minggu') || query.includes('week')) {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      startDate = new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Parse limit
    const limitMatch = query.match(/(\d+)/);
    if (limitMatch) {
      limit = parseInt(limitMatch[1]);
    }

    const sales = await saleService.getAll(tenantId, {
      startDate,
      endDate,
      pageSize: 1000,
    });

    // Aggregate by product
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    sales.data.forEach((sale: any) => {
      sale.items.forEach((item: any) => {
        const productId = item.productId;
        const productName = item.product?.name || 'Unknown';
        
        if (!productSales[productId]) {
          productSales[productId] = {
            name: productName,
            quantity: 0,
            revenue: 0,
          };
        }

        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += parseFloat(item.amount.toString());
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    if (topProducts.length === 0) {
      return {
        tool: 'get_top_products',
        data: [],
        message: 'Tidak ada data penjualan untuk periode tersebut.',
      };
    }

    let message = `🏆 Top ${topProducts.length} Produk Terlaris:\n\n`;
    topProducts.forEach((product, index) => {
      message += `${index + 1}. ${product.name}\n`;
      message += `   • Terjual: ${product.quantity} unit\n`;
      message += `   • Omzet: Rp ${product.revenue.toLocaleString('id-ID')}\n\n`;
    });

    return {
      tool: 'get_top_products',
      data: topProducts,
      message,
    };
  }

  private async handleProfitLossQuery(tenantId: string, query: string): Promise<AIQueryResponse> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    // Parse month
    if (query.includes('bulan ini') || query.includes('this month')) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (query.includes('bulan lalu') || query.includes('last month')) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const profitLoss = await reportService.getProfitLoss(tenantId, startDate, endDate);

    const period = this.formatDateRange(startDate, endDate);
    let message = `💰 Laporan Laba Rugi (${period}):\n\n`;
    message += `📈 Pendapatan: Rp ${profitLoss.revenue.total.toLocaleString('id-ID')}\n`;
    message += `📉 Beban: Rp ${profitLoss.expenses.total.toLocaleString('id-ID')}\n\n`;
    
    if (profitLoss.netIncome > 0) {
      message += `✅ Laba Bersih: Rp ${profitLoss.netIncome.toLocaleString('id-ID')}`;
    } else if (profitLoss.netIncome < 0) {
      message += `❌ Rugi Bersih: Rp ${Math.abs(profitLoss.netIncome).toLocaleString('id-ID')}`;
    } else {
      message += `⚖️ Impas (Tidak ada laba/rugi)`;
    }

    // If asking why profit decreased
    if (query.includes('turun') || query.includes('menurun') || query.includes('decrease')) {
      // Compare with previous period
      const prevStartDate = new Date(startDate);
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(0);

      try {
        const prevProfitLoss = await reportService.getProfitLoss(tenantId, prevStartDate, prevEndDate);
        const revenueChange = profitLoss.revenue.total - prevProfitLoss.revenue.total;
        const expenseChange = profitLoss.expenses.total - prevProfitLoss.expenses.total;
        const profitChange = profitLoss.netIncome - prevProfitLoss.netIncome;

        message += `\n\n📊 Perbandingan dengan periode sebelumnya:\n`;
        message += `• Perubahan Pendapatan: ${revenueChange >= 0 ? '+' : ''}Rp ${revenueChange.toLocaleString('id-ID')}\n`;
        message += `• Perubahan Beban: ${expenseChange >= 0 ? '+' : ''}Rp ${expenseChange.toLocaleString('id-ID')}\n`;
        message += `• Perubahan Laba: ${profitChange >= 0 ? '+' : ''}Rp ${profitChange.toLocaleString('id-ID')}\n`;

        if (profitChange < 0) {
          if (revenueChange < 0 && expenseChange > 0) {
            message += `\n💡 Analisis: Laba turun karena pendapatan menurun dan beban meningkat.`;
          } else if (revenueChange < 0) {
            message += `\n💡 Analisis: Laba turun karena pendapatan menurun.`;
          } else if (expenseChange > 0) {
            message += `\n💡 Analisis: Laba turun karena beban meningkat lebih cepat daripada pendapatan.`;
          }
        }
      } catch (error) {
        // Ignore comparison errors
      }
    }

    return {
      tool: 'get_profit_loss',
      data: profitLoss,
      message,
    };
  }

  private async handleTrendQuery(tenantId: string, query: string): Promise<AIQueryResponse> {
    // This is a simplified trend analysis
    // In a real implementation, you'd compare multiple periods
    
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentPL = await reportService.getProfitLoss(tenantId, currentStart, currentEnd);
    const prevPL = await reportService.getProfitLoss(tenantId, prevStart, prevEnd);

    const revenueChange = currentPL.revenue.total - prevPL.revenue.total;
    const expenseChange = currentPL.expenses.total - prevPL.expenses.total;
    const profitChange = currentPL.netIncome - prevPL.netIncome;

    const revenueChangePercent = prevPL.revenue.total > 0 
      ? ((revenueChange / prevPL.revenue.total) * 100).toFixed(1)
      : '0';
    const profitChangePercent = prevPL.netIncome !== 0
      ? ((profitChange / Math.abs(prevPL.netIncome)) * 100).toFixed(1)
      : '0';

    let message = `📈 Analisis Trend:\n\n`;
    message += `Pendapatan: ${revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(parseFloat(revenueChangePercent))}% (${revenueChange >= 0 ? '+' : ''}Rp ${revenueChange.toLocaleString('id-ID')})\n`;
    message += `Beban: ${expenseChange >= 0 ? '↑' : '↓'} ${Math.abs(parseFloat(profitChangePercent))}% (${expenseChange >= 0 ? '+' : ''}Rp ${expenseChange.toLocaleString('id-ID')})\n`;
    message += `Laba: ${profitChange >= 0 ? '↑' : '↓'} ${Math.abs(parseFloat(profitChangePercent))}% (${profitChange >= 0 ? '+' : ''}Rp ${profitChange.toLocaleString('id-ID')})`;

    return {
      tool: 'explain_trend',
      data: {
        current: currentPL,
        previous: prevPL,
        changes: {
          revenue: revenueChange,
          expense: expenseChange,
          profit: profitChange,
        },
      },
      message,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private formatDateRange(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const endStr = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }
}

export const aiQueryService = new AIQueryService();

