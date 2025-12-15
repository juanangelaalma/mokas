import { complete, isAIConfigured, AIMessage } from '@/lib/ai';
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

interface ConversationContext {
  tenantId: string;
  businessData?: {
    inventory?: any[];
    recentSales?: any;
    profitLoss?: any;
    topProducts?: any[];
  };
}

export class AIQueryService {
  private conversationHistory: Map<string, AIMessage[]> = new Map();

  async processQuery(tenantId: string, userQuery: string): Promise<AIQueryResponse> {
    if (!isAIConfigured()) {
      return {
        tool: 'error',
        data: null,
        message: 'AI belum dikonfigurasi. Silakan atur AI_PROVIDER dan API key di environment variables.',
      };
    }

    try {
      const context = await this.gatherBusinessContext(tenantId, userQuery);
      const response = await this.generateResponse(tenantId, userQuery, context);
      return response;
    } catch (error: any) {
      console.error('AI Query Error:', error);
      return {
        tool: 'error',
        data: null,
        message: `Terjadi kesalahan saat memproses pertanyaan: ${error.message}`,
      };
    }
  }

  private async gatherBusinessContext(tenantId: string, query: string): Promise<ConversationContext> {
    const context: ConversationContext = {
      tenantId,
      businessData: {},
    };

    const queryLower = query.toLowerCase();

    const shouldFetchInventory = /stok|inventory|persediaan|barang|produk/.test(queryLower);
    const shouldFetchSales = /penjualan|omzet|revenue|pendapatan|transaksi/.test(queryLower);
    const shouldFetchProfitLoss = /laba|rugi|profit|loss|keuntungan|kerugian/.test(queryLower);
    const shouldFetchTopProducts = /terlaris|tertinggi|top|ranking/.test(queryLower);

    const fetchPromises: Promise<void>[] = [];

    if (shouldFetchInventory) {
      fetchPromises.push(
        productService.getAll(tenantId).then(products => {
          context.businessData!.inventory = products.filter(p => p.type === 'INVENTORY');
        }).catch(() => {})
      );
    }

    if (shouldFetchSales || shouldFetchTopProducts) {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      fetchPromises.push(
        saleService.getAll(tenantId, { startDate, endDate, pageSize: 100 }).then(sales => {
          context.businessData!.recentSales = sales;

          if (shouldFetchTopProducts) {
            const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
            sales.data.forEach((sale: any) => {
              sale.items?.forEach((item: any) => {
                const productId = item.productId;
                const productName = item.product?.name || 'Unknown';
                if (!productSales[productId]) {
                  productSales[productId] = { name: productName, quantity: 0, revenue: 0 };
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].revenue += parseFloat(item.amount?.toString() || '0');
              });
            });
            context.businessData!.topProducts = Object.values(productSales)
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 10);
          }
        }).catch(() => {})
      );
    }

    if (shouldFetchProfitLoss) {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      fetchPromises.push(
        reportService.getProfitLoss(tenantId, startDate, endDate).then(pl => {
          context.businessData!.profitLoss = pl;
        }).catch(() => {})
      );
    }

    await Promise.all(fetchPromises);
    return context;
  }

  private async generateResponse(
    tenantId: string,
    userQuery: string,
    context: ConversationContext
  ): Promise<AIQueryResponse> {
    const systemPrompt = this.buildSystemPrompt(context);
    
    let history = this.conversationHistory.get(tenantId) || [];
    
    if (history.length > 20) {
      history = history.slice(-10);
    }

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userQuery },
    ];

    const response = await complete({ messages });

    history.push(
      { role: 'user', content: userQuery },
      { role: 'assistant', content: response.content }
    );
    this.conversationHistory.set(tenantId, history);

    const tool = this.detectToolFromResponse(userQuery, context);

    return {
      tool,
      data: context.businessData,
      message: response.content,
    };
  }

  private buildSystemPrompt(context: ConversationContext): string {
    let prompt = `Kamu adalah AI Assistant untuk aplikasi akuntansi bisnis. Bantu pengguna menganalisis data bisnis mereka dengan bahasa Indonesia yang ramah dan informatif.

Panduan:
- Berikan jawaban yang jelas dan ringkas
- Gunakan format angka Indonesia (titik sebagai pemisah ribuan)
- Jika data tidak tersedia, sampaikan dengan sopan
- Berikan insight bisnis yang relevan jika memungkinkan
- Jangan membuat data fiktif, gunakan hanya data yang diberikan

`;

    if (context.businessData?.inventory?.length) {
      const inventory = context.businessData.inventory;
      const lowStock = inventory.filter((p: any) => p.minStock && p.currentStock <= p.minStock);
      
      prompt += `\n## Data Inventory Saat Ini:
Total produk: ${inventory.length}
Produk stok rendah: ${lowStock.length}

Daftar produk (sample):
${inventory.slice(0, 10).map((p: any) => `- ${p.name}: ${p.currentStock} ${p.unit} (Nilai: Rp ${(p.stockValue || 0).toLocaleString('id-ID')})`).join('\n')}
`;
    }

    if (context.businessData?.recentSales) {
      const sales = context.businessData.recentSales;
      const totalSales = sales.data?.reduce((sum: number, sale: any) => 
        sum + parseFloat(sale.totalAmount?.toString() || '0'), 0) || 0;
      
      prompt += `\n## Data Penjualan Bulan Ini:
Total transaksi: ${sales.total || 0}
Total omzet: Rp ${totalSales.toLocaleString('id-ID')}
`;
    }

    if (context.businessData?.topProducts?.length) {
      prompt += `\n## Top Produk Terlaris:
${context.businessData.topProducts.slice(0, 5).map((p: any, i: number) => 
  `${i + 1}. ${p.name} - ${p.quantity} unit - Rp ${p.revenue.toLocaleString('id-ID')}`).join('\n')}
`;
    }

    if (context.businessData?.profitLoss) {
      const pl = context.businessData.profitLoss;
      prompt += `\n## Laba Rugi Bulan Ini:
Pendapatan: Rp ${(pl.revenue?.total || 0).toLocaleString('id-ID')}
Beban: Rp ${(pl.expenses?.total || 0).toLocaleString('id-ID')}
Laba Bersih: Rp ${(pl.netIncome || 0).toLocaleString('id-ID')}
`;
    }

    return prompt;
  }

  private detectToolFromResponse(query: string, context: ConversationContext): string {
    const q = query.toLowerCase();
    
    if (/stok|inventory|persediaan|barang/.test(q)) return 'get_inventory';
    if (/terlaris|tertinggi|top|ranking/.test(q)) return 'get_top_products';
    if (/penjualan|omzet|revenue/.test(q)) return 'get_sales_summary';
    if (/laba|rugi|profit|loss/.test(q)) return 'get_profit_loss';
    if (/trend|tren|perubahan/.test(q)) return 'explain_trend';
    
    return 'general_query';
  }

  clearHistory(tenantId: string): void {
    this.conversationHistory.delete(tenantId);
  }
}

export const aiQueryService = new AIQueryService();
