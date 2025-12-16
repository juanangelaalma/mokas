import { vectorStore } from './vector-store';
import { BusinessDocument, DocType } from './types';

/**
 * Creates a text representation of a product for embedding
 */
function productToText(product: any): string {
    const parts = [
        `Produk: ${product.name}`,
        product.sku ? `SKU: ${product.sku}` : '',
        product.description ? `Deskripsi: ${product.description}` : '',
        `Tipe: ${product.type}`,
        product.category ? `Kategori: ${product.category}` : '',
        product.currentStock !== undefined ? `Stok: ${product.currentStock} ${product.unit || ''}` : '',
        product.minStock !== undefined ? `Minimum Stok: ${product.minStock}` : '',
        product.stockValue !== undefined ? `Nilai Stok: Rp ${product.stockValue.toLocaleString('id-ID')}` : '',
        product.sellingPrice ? `Harga Jual: Rp ${parseFloat(product.sellingPrice).toLocaleString('id-ID')}` : '',
    ];

    return parts.filter(Boolean).join('. ');
}

/**
 * Creates a text representation of a sale for embedding
 */
function saleToText(sale: any): string {
    const date = new Date(sale.date || sale.createdAt).toLocaleDateString('id-ID');
    const items = sale.items?.map((item: any) =>
        `${item.product?.name || 'Produk'} x ${item.quantity}`
    ).join(', ') || '';

    const parts = [
        `Transaksi penjualan tanggal ${date}`,
        sale.invoiceNumber ? `No Invoice: ${sale.invoiceNumber}` : '',
        sale.contact?.name ? `Pelanggan: ${sale.contact.name}` : '',
        items ? `Item: ${items}` : '',
        sale.totalAmount ? `Total: Rp ${parseFloat(sale.totalAmount).toLocaleString('id-ID')}` : '',
        sale.status ? `Status: ${sale.status}` : '',
    ];

    return parts.filter(Boolean).join('. ');
}

/**
 * Creates a text representation of profit/loss for embedding
 */
function profitLossToText(pl: any, period: string): string {
    return `Laporan Laba Rugi ${period}. ` +
        `Pendapatan: Rp ${(pl.revenue?.total || 0).toLocaleString('id-ID')}. ` +
        `Beban: Rp ${(pl.expenses?.total || 0).toLocaleString('id-ID')}. ` +
        `Laba Bersih: Rp ${(pl.netIncome || 0).toLocaleString('id-ID')}.`;
}

/**
 * Creates a text representation of top products for embedding
 */
function topProductsToText(products: any[], period: string): string {
    const items = products.slice(0, 10).map((p, i) =>
        `${i + 1}. ${p.name}: ${p.quantity} unit, Rp ${p.revenue.toLocaleString('id-ID')}`
    ).join('. ');

    return `Produk terlaris ${period}: ${items}`;
}

/**
 * Index a product into the vector store (call after create/update)
 */
export async function embedProduct(product: any, tenantId: string): Promise<void> {
    const doc: BusinessDocument = {
        id: `product_${product.id}`,
        tenantId,
        type: 'product',
        content: productToText(product),
        metadata: {
            productId: product.id,
            name: product.name,
            type: product.type,
            currentStock: product.currentStock,
            minStock: product.minStock,
        },
    };

    await vectorStore.indexDocument(doc);
}

/**
 * Index a sale into the vector store (call after create)
 */
export async function embedSale(sale: any, tenantId: string): Promise<void> {
    const doc: BusinessDocument = {
        id: `sale_${sale.id}`,
        tenantId,
        type: 'sale',
        content: saleToText(sale),
        metadata: {
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
            totalAmount: sale.totalAmount,
            date: sale.date || sale.createdAt,
        },
    };

    await vectorStore.indexDocument(doc);
}

/**
 * Index profit/loss report into the vector store
 */
export async function embedProfitLoss(
    pl: any,
    tenantId: string,
    startDate: Date,
    endDate: Date
): Promise<void> {
    const period = `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
    const docId = `pl_${tenantId}_${startDate.getTime()}_${endDate.getTime()}`;

    const doc: BusinessDocument = {
        id: docId,
        tenantId,
        type: 'profit_loss',
        content: profitLossToText(pl, period),
        metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            revenue: pl.revenue?.total,
            expenses: pl.expenses?.total,
            netIncome: pl.netIncome,
        },
    };

    await vectorStore.indexDocument(doc);
}

/**
 * Index top products into the vector store
 */
export async function embedTopProducts(
    products: any[],
    tenantId: string,
    startDate: Date,
    endDate: Date
): Promise<void> {
    const period = `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
    const docId = `top_${tenantId}_${startDate.getTime()}_${endDate.getTime()}`;

    const doc: BusinessDocument = {
        id: docId,
        tenantId,
        type: 'top_product',
        content: topProductsToText(products, period),
        metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            products: products.slice(0, 10),
        },
    };

    await vectorStore.indexDocument(doc);
}

/**
 * Remove a product from the vector store (call after delete)
 */
export async function removeProductEmbedding(productId: string): Promise<void> {
    await vectorStore.deleteDocument(`product_${productId}`);
}

/**
 * Remove a sale from the vector store (call after delete)
 */
export async function removeSaleEmbedding(saleId: string): Promise<void> {
    await vectorStore.deleteDocument(`sale_${saleId}`);
}
