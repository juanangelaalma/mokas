const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-004';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export async function generateEmbedding(text: string): Promise<number[]> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const url = `${BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${EMBEDDING_MODEL}`,
            content: {
                parts: [{ text }],
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini Embedding API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.embedding?.values || [];
}

export async function generateBatchEmbeddings(
    texts: string[],
    batchSize: number = 10,
    delayMs: number = 100
): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map((text) => generateEmbedding(text))
        );

        results.push(...batchResults);

        // Rate limit delay between batches
        if (i + batchSize < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    return results;
}
