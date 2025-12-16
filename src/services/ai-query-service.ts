import { complete, isAIConfigured, AIMessage } from '@/lib/ai';
import { vectorStore, SearchResult } from '@/lib/vector';

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

interface RelevantContext {
  documents: SearchResult[];
  summary: string;
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
      // Use vector search to find relevant context
      const context = await this.searchRelevantContext(tenantId, userQuery);
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

  /**
   * Search for relevant documents using vector similarity
   */
  private async searchRelevantContext(
    tenantId: string,
    query: string
  ): Promise<RelevantContext> {
    const documents = await vectorStore.searchSimilar(query, tenantId, 5);
    console.log("===========================")
    console.log(documents)

    // Build a summary from the retrieved documents
    const summary = documents
      .map((doc) => doc.payload.content)
      .join('\n\n');

    return { documents, summary };
  }

  private async generateResponse(
    tenantId: string,
    userQuery: string,
    context: RelevantContext
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
      data: context.documents.map((d) => d.payload.metadata),
      message: response.content,
    };
  }

  private buildSystemPrompt(context: RelevantContext): string {
    let prompt = `Kamu adalah AI Assistant untuk aplikasi akuntansi bisnis. Bantu pengguna menganalisis data bisnis mereka dengan bahasa Indonesia yang ramah dan informatif.

Panduan:
- Berikan jawaban yang jelas dan ringkas
- Gunakan format angka Indonesia (titik sebagai pemisah ribuan)
- Jika data tidak tersedia, sampaikan dengan sopan
- Berikan insight bisnis yang relevan jika memungkinkan
- Jangan membuat data fiktif, gunakan hanya data yang diberikan

`;

    if (context.summary) {
      prompt += `## Data Bisnis yang Relevan:
${context.summary}
`;
    } else {
      prompt += `## Catatan:
Tidak ada data spesifik yang ditemukan untuk pertanyaan ini. Berikan jawaban umum atau minta pengguna untuk lebih spesifik.
`;
    }

    return prompt;
  }

  private detectToolFromResponse(query: string, context: RelevantContext): string {
    const q = query.toLowerCase();

    if (/stok|inventory|persediaan|barang/.test(q)) return 'get_inventory';
    if (/terlaris|tertinggi|top|ranking/.test(q)) return 'get_top_products';
    if (/penjualan|omzet|revenue/.test(q)) return 'get_sales_summary';
    if (/laba|rugi|profit|loss/.test(q)) return 'get_profit_loss';
    if (/trend|tren|perubahan/.test(q)) return 'explain_trend';

    // Also check context types
    if (context.documents.length > 0) {
      const types = context.documents.map((d) => d.payload.type);
      if (types.includes('product')) return 'get_inventory';
      if (types.includes('sale')) return 'get_sales_summary';
      if (types.includes('profit_loss')) return 'get_profit_loss';
      if (types.includes('top_product')) return 'get_top_products';
    }

    return 'general_query';
  }

  clearHistory(tenantId: string): void {
    this.conversationHistory.delete(tenantId);
  }
}

export const aiQueryService = new AIQueryService();
