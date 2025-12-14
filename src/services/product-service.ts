import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { CreateProductInput, UpdateProductInput } from '@/schemas/product.schema';
import { ProductType } from '@prisma/client';

export class ProductService {
  async getAll(tenantId: string, type?: ProductType) {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(type && { type }),
        isActive: true,
      },
      orderBy: { sku: 'asc' },
    });

    // Add stock info for inventory products
    const productsWithStock = await Promise.all(
      products.map(async (product) => {
        if (product.type === 'SERVICE') {
          return { ...product, currentStock: null, stockValue: null };
        }

        const stockInfo = await this.getStockInfo(tenantId, product.id);
        return {
          ...product,
          currentStock: stockInfo.quantity,
          stockValue: stockInfo.value.toNumber(),
        };
      })
    );

    return productsWithStock;
  }

  async getById(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) return null;

    if (product.type === 'SERVICE') {
      return { ...product, currentStock: null, stockValue: null };
    }

    const stockInfo = await this.getStockInfo(tenantId, product.id);
    return {
      ...product,
      currentStock: stockInfo.quantity,
      stockValue: stockInfo.value.toNumber(),
    };
  }

  async getStockInfo(tenantId: string, productId: string) {
    const layers = await prisma.inventoryLayer.findMany({
      where: {
        tenantId,
        productId,
        remainingQty: { gt: 0 },
      },
    });

    const quantity = layers.reduce((sum, l) => sum + l.remainingQty, 0);
    const value = layers.reduce(
      (sum, l) => sum.add(new Decimal(l.unitCost.toString()).mul(l.remainingQty)),
      new Decimal(0)
    );

    return { quantity, value };
  }

  async create(tenantId: string, input: CreateProductInput) {
    // Check SKU uniqueness
    const existing = await prisma.product.findFirst({
      where: { tenantId, sku: input.sku },
    });
    if (existing) throw new Error('SKU sudah digunakan');

    // Get default accounts
    const inventoryAccount = await prisma.account.findFirst({
      where: { tenantId, code: '1-1200' },
    });
    const cogsAccount = await prisma.account.findFirst({
      where: { tenantId, code: '5-1001' },
    });
    const revenueAccount = await prisma.account.findFirst({
      where: { tenantId, code: '4-1001' },
    });

    return prisma.product.create({
      data: {
        tenantId,
        sku: input.sku,
        name: input.name,
        description: input.description || null,
        type: input.type,
        unit: input.unit,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        trackStock: input.type === 'INVENTORY' ? input.trackStock : false,
        minStock: input.minStock,
        inventoryAccountId: input.type === 'INVENTORY' ? inventoryAccount?.id : null,
        cogsAccountId: input.type === 'INVENTORY' ? cogsAccount?.id : null,
        revenueAccountId: revenueAccount?.id,
        isActive: input.isActive,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdateProductInput) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new Error('Produk tidak ditemukan');

    // Check SKU uniqueness if changed
    if (input.sku && input.sku !== product.sku) {
      const existing = await prisma.product.findFirst({
        where: { tenantId, sku: input.sku },
      });
      if (existing) throw new Error('SKU sudah digunakan');
    }

    return prisma.product.update({
      where: { id },
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description,
        unit: input.unit,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        trackStock: input.trackStock,
        minStock: input.minStock,
        isActive: input.isActive,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new Error('Produk tidak ditemukan');

    // Check for existing transactions
    const saleItemsCount = await prisma.saleItem.count({ where: { productId: id } });
    const purchaseItemsCount = await prisma.purchaseItem.count({ where: { productId: id } });

    if (saleItemsCount > 0 || purchaseItemsCount > 0) {
      throw new Error('Produk tidak dapat dihapus karena memiliki transaksi');
    }

    return prisma.product.delete({ where: { id } });
  }

  async getInventoryLayers(tenantId: string, productId: string) {
    return prisma.inventoryLayer.findMany({
      where: {
        tenantId,
        productId,
      },
      orderBy: [{ receivedDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getLowStockProducts(tenantId: string) {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        type: 'INVENTORY',
        isActive: true,
        trackStock: true,
      },
    });

    const lowStock = [];

    for (const product of products) {
      const stockInfo = await this.getStockInfo(tenantId, product.id);
      if (stockInfo.quantity <= product.minStock) {
        lowStock.push({
          ...product,
          currentStock: stockInfo.quantity,
          stockValue: stockInfo.value.toNumber(),
        });
      }
    }

    return lowStock;
  }
}

export const productService = new ProductService();
