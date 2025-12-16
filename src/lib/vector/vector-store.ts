import { qdrantClient } from './qdrant-client';
import { generateEmbedding } from './embedding';
import { BusinessDocument, VectorPoint, SearchResult } from './types';

export class VectorStore {
    async indexDocument(doc: BusinessDocument): Promise<void> {
        try {
            const vector = await generateEmbedding(doc.content);

            const point: VectorPoint = {
                id: doc.id,
                vector,
                payload: {
                    tenantId: doc.tenantId,
                    type: doc.type,
                    content: doc.content,
                    metadata: doc.metadata,
                },
            };

            await qdrantClient.upsertPoints([point]);
        } catch (error) {
            console.error(`Failed to index document ${doc.id}:`, error);
            // Don't throw - embedding failures shouldn't break the main flow
        }
    }

    async indexDocuments(docs: BusinessDocument[]): Promise<void> {
        for (const doc of docs) {
            await this.indexDocument(doc);
        }
    }

    async searchSimilar(
        query: string,
        tenantId: string,
        topK: number = 5
    ): Promise<SearchResult[]> {
        try {
            const queryVector = await generateEmbedding(query);
            return await qdrantClient.search(queryVector, tenantId, topK);
        } catch (error) {
            console.error('Vector search failed:', error);
            return [];
        }
    }

    async deleteDocument(docId: string): Promise<void> {
        try {
            await qdrantClient.deletePoints([docId]);
        } catch (error) {
            console.error(`Failed to delete document ${docId}:`, error);
        }
    }

    async deleteByTenant(tenantId: string, type?: string): Promise<void> {
        try {
            await qdrantClient.deleteByFilter(tenantId, type);
        } catch (error) {
            console.error(`Failed to delete documents for tenant ${tenantId}:`, error);
        }
    }
}

export const vectorStore = new VectorStore();
