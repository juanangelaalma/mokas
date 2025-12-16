import { COLLECTION_NAME, VECTOR_DIMENSION, VectorPoint, SearchResult } from './types';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

/**
 * Convert a string ID to a valid UUID format for Qdrant
 */
function stringToUuid(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    const strHash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hex2 = Math.abs(strHash).toString(16).padStart(4, '0');
    return `${hex}-${hex2.slice(0, 4)}-4000-8000-${hex}${hex2}`.slice(0, 36);
}

export class QdrantClient {
    private baseUrl: string;

    constructor(url?: string) {
        this.baseUrl = url || QDRANT_URL;
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async ensureCollection(): Promise<void> {
        const exists = await this.collectionExists();
        if (!exists) {
            await this.createCollection();
        }
    }

    private async collectionExists(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/collections/${COLLECTION_NAME}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    private async createCollection(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/collections/${COLLECTION_NAME}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vectors: {
                    size: VECTOR_DIMENSION,
                    distance: 'Cosine',
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create collection: ${error}`);
        }
    }

    async upsertPoints(points: VectorPoint[]): Promise<void> {
        await this.ensureCollection();

        const response = await fetch(`${this.baseUrl}/collections/${COLLECTION_NAME}/points`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                points: points.map((p) => ({
                    id: stringToUuid(p.id),
                    vector: p.vector,
                    payload: {
                        originalId: p.id,
                        ...p.payload,
                    },
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to upsert points: ${error}`);
        }
    }

    async search(
        vector: number[],
        tenantId: string,
        limit: number = 5
    ): Promise<SearchResult[]> {
        await this.ensureCollection();

        const response = await fetch(`${this.baseUrl}/collections/${COLLECTION_NAME}/points/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vector,
                limit,
                with_payload: true,
                filter: {
                    must: [
                        {
                            key: 'tenantId',
                            match: { value: tenantId },
                        },
                    ],
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to search: ${error}`);
        }

        const data = await response.json();
        return (data.result || []).map((r: any) => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
        }));
    }

    async deletePoints(ids: string[]): Promise<void> {
        await this.ensureCollection();

        const response = await fetch(`${this.baseUrl}/collections/${COLLECTION_NAME}/points/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                points: ids.map(id => stringToUuid(id)),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete points: ${error}`);
        }
    }

    async deleteByFilter(tenantId: string, type?: string): Promise<void> {
        await this.ensureCollection();

        const filter: any = {
            must: [{ key: 'tenantId', match: { value: tenantId } }],
        };

        if (type) {
            filter.must.push({ key: 'type', match: { value: type } });
        }

        const response = await fetch(`${this.baseUrl}/collections/${COLLECTION_NAME}/points/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filter }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete by filter: ${error}`);
        }
    }
}

export const qdrantClient = new QdrantClient();
