/**
 * Script to sync existing data to Qdrant vector database
 * Run with: npm run sync:vectors
 */

import { PrismaClient } from '@prisma/client';

// Direct imports to avoid @/ alias issues in scripts
const prisma = new PrismaClient();

// Inline implementations to avoid module resolution issues in script context
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'mokas_business_docs';
const VECTOR_DIMENSION = 768;
const EMBEDDING_MODEL = 'text-embedding-004';

interface BusinessDocument {
    id: string;
    tenantId: string;
    type: 'product' | 'sale' | 'profit_loss' | 'top_product';
    content: string;
    metadata: Record<string, any>;
}

/**
 * Convert a string ID to a valid UUID format for Qdrant
 * Uses a simple hash to generate deterministic UUID-like string
 */
function stringToUuid(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Create a UUID-like string from the hash and original string
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    const strHash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hex2 = Math.abs(strHash).toString(16).padStart(4, '0');

    // Format: 8-4-4-4-12 (standard UUID format)
    return `${hex}-${hex2.slice(0, 4)}-4000-8000-${hex}${hex2}`.slice(0, 36);
}

async function generateEmbedding(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Embedding API error: ${error}`);
    }

    const data = await response.json();
    return data.embedding?.values || [];
}

async function ensureCollection(): Promise<void> {
    try {
        const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
        if (response.ok) {
            console.log('Collection already exists');
            return;
        }
    } catch { }

    const createResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vectors: { size: VECTOR_DIMENSION, distance: 'Cosine' },
        }),
    });

    if (!createResponse.ok) {
        throw new Error('Failed to create collection');
    }
    console.log('Collection created');
}

async function upsertPoint(doc: BusinessDocument): Promise<void> {
    const vector = await generateEmbedding(doc.content);
    const uuid = stringToUuid(doc.id);

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            points: [{
                id: uuid,
                vector,
                payload: {
                    originalId: doc.id,
                    tenantId: doc.tenantId,
                    type: doc.type,
                    content: doc.content,
                    metadata: doc.metadata,
                },
            }],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upsert: ${error}`);
    }
}

function productToText(product: any, stockInfo: { quantity: number; value: number }): string {
    return [
        `Produk: ${product.name}`,
        `SKU: ${product.sku}`,
        `Tipe: ${product.type}`,
        product.description ? `Deskripsi: ${product.description}` : '',
        `Stok: ${stockInfo.quantity} ${product.unit || ''}`,
        `Nilai Stok: Rp ${stockInfo.value.toLocaleString('id-ID')}`,
        product.sellingPrice ? `Harga Jual: Rp ${parseFloat(product.sellingPrice).toLocaleString('id-ID')}` : '',
    ].filter(Boolean).join('. ');
}

function saleToText(sale: any): string {
    const date = new Date(sale.saleDate).toLocaleDateString('id-ID');
    const items = sale.items?.map((item: any) =>
        `${item.product?.name || 'Produk'} x ${item.quantity}`
    ).join(', ') || '';

    return [
        `Transaksi penjualan tanggal ${date}`,
        `No Invoice: ${sale.saleNumber}`,
        sale.contact?.name ? `Pelanggan: ${sale.contact.name}` : '',
        items ? `Item: ${items}` : '',
        `Total: Rp ${parseFloat(sale.totalAmount).toLocaleString('id-ID')}`,
        `Status: ${sale.status}`,
    ].filter(Boolean).join('. ');
}

async function getStockInfo(tenantId: string, productId: string) {
    const layers = await prisma.inventoryLayer.findMany({
        where: { tenantId, productId, remainingQty: { gt: 0 } },
    });

    const quantity = layers.reduce((sum, l) => sum + l.remainingQty, 0);
    const value = layers.reduce((sum, l) => sum + (parseFloat(l.unitCost.toString()) * l.remainingQty), 0);

    return { quantity, value };
}

async function syncProducts(tenantId: string): Promise<number> {
    console.log('Syncing products...');
    const products = await prisma.product.findMany({
        where: { tenantId, isActive: true },
    });

    let count = 0;
    for (const product of products) {
        try {
            const stockInfo = product.type === 'INVENTORY'
                ? await getStockInfo(tenantId, product.id)
                : { quantity: 0, value: 0 };

            const doc: BusinessDocument = {
                id: `product_${product.id}`,
                tenantId,
                type: 'product',
                content: productToText(product, stockInfo),
                metadata: {
                    productId: product.id,
                    name: product.name,
                    type: product.type,
                },
            };

            await upsertPoint(doc);
            count++;
            console.log(`  - Indexed: ${product.name}`);

            // Rate limit delay
            await new Promise((r) => setTimeout(r, 100));
        } catch (error) {
            console.error(`  - Failed: ${product.name}`, error);
        }
    }

    return count;
}

async function syncSales(tenantId: string): Promise<number> {
    console.log('Syncing sales...');
    const sales = await prisma.sale.findMany({
        where: { tenantId },
        include: {
            contact: { select: { name: true } },
            items: { include: { product: { select: { name: true } } } },
        },
        take: 100, // Limit for initial sync
        orderBy: { saleDate: 'desc' },
    });

    let count = 0;
    for (const sale of sales) {
        try {
            const doc: BusinessDocument = {
                id: `sale_${sale.id}`,
                tenantId,
                type: 'sale',
                content: saleToText(sale),
                metadata: {
                    saleId: sale.id,
                    saleNumber: sale.saleNumber,
                    totalAmount: sale.totalAmount,
                },
            };

            await upsertPoint(doc);
            count++;
            console.log(`  - Indexed: ${sale.saleNumber}`);

            await new Promise((r) => setTimeout(r, 100));
        } catch (error) {
            console.error(`  - Failed: ${sale.saleNumber}`, error);
        }
    }

    return count;
}

async function main() {
    console.log('=== Sync Vectors to Qdrant ===\n');

    if (!GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY is not set');
        process.exit(1);
    }

    // Check Qdrant connection
    try {
        const response = await fetch(`${QDRANT_URL}/`);
        if (!response.ok) throw new Error('Qdrant not responding');
        console.log('✓ Qdrant connection OK\n');
    } catch {
        console.error('Error: Cannot connect to Qdrant at', QDRANT_URL);
        console.error('Make sure Qdrant is running: docker-compose up -d qdrant');
        process.exit(1);
    }

    await ensureCollection();

    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`Found ${tenants.length} tenant(s)\n`);

    let totalProducts = 0;
    let totalSales = 0;

    for (const tenant of tenants) {
        console.log(`\n--- Tenant: ${tenant.name} ---`);
        totalProducts += await syncProducts(tenant.id);
        totalSales += await syncSales(tenant.id);
    }

    console.log(`\n=== Summary ===`);
    console.log(`Products indexed: ${totalProducts}`);
    console.log(`Sales indexed: ${totalSales}`);
    console.log(`Total documents: ${totalProducts + totalSales}`);

    await prisma.$disconnect();
}

main().catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
});
