export type DocType = 'product' | 'sale' | 'profit_loss' | 'top_product';

export interface BusinessDocument {
    id: string;
    tenantId: string;
    type: DocType;
    content: string;
    metadata: Record<string, any>;
}

export interface VectorPoint {
    id: string;
    vector: number[];
    payload: {
        tenantId: string;
        type: DocType;
        content: string;
        metadata: Record<string, any>;
    };
}

export interface SearchResult {
    id: string;
    score: number;
    payload: VectorPoint['payload'];
}

export const COLLECTION_NAME = 'mokas_business_docs';
export const VECTOR_DIMENSION = 768; // Gemini embedding dimension
