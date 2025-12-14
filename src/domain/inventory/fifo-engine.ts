import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

export interface FIFOConsumptionResult {
  success: boolean;
  totalCost: Decimal;
  details: FIFODetail[];
  error?: string;
}

export interface FIFODetail {
  inventoryLayerId: string;
  quantityConsumed: number;
  unitCost: Decimal;
  totalCost: Decimal;
  layerRemainingAfter: number;
}

export interface CreateLayerInput {
  tenantId: string;
  productId: string;
  sourceType: 'PURCHASE' | 'RETURN' | 'OPENING' | 'ADJUSTMENT';
  sourceId?: string;
  quantity: number;
  unitCost: Decimal;
  receivedDate: Date;
}

/**
 * Consume inventory using FIFO (First In, First Out) method.
 * Oldest layers are consumed first.
 */
export async function consumeInventoryFIFO(
  tenantId: string,
  productId: string,
  quantityNeeded: number,
  tx: Prisma.TransactionClient
): Promise<FIFOConsumptionResult> {
  // 1. Get available inventory layers ordered by FIFO (oldest first)
  const layers = await tx.inventoryLayer.findMany({
    where: {
      tenantId,
      productId,
      remainingQty: { gt: 0 },
    },
    orderBy: [
      { receivedDate: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // 2. Calculate total available
  const totalAvailable = layers.reduce((sum, layer) => sum + layer.remainingQty, 0);

  if (totalAvailable < quantityNeeded) {
    return {
      success: false,
      totalCost: new Decimal(0),
      details: [],
      error: `Stok tidak cukup. Tersedia: ${totalAvailable}, Dibutuhkan: ${quantityNeeded}`,
    };
  }

  // 3. Consume layers in FIFO order
  let remainingToConsume = quantityNeeded;
  let totalCost = new Decimal(0);
  const details: FIFODetail[] = [];

  for (const layer of layers) {
    if (remainingToConsume <= 0) break;

    const takeFromLayer = Math.min(remainingToConsume, layer.remainingQty);
    const layerUnitCost = new Decimal(layer.unitCost.toString());
    const consumptionCost = layerUnitCost.mul(takeFromLayer);

    const newRemaining = layer.remainingQty - takeFromLayer;

    await tx.inventoryLayer.update({
      where: { id: layer.id },
      data: { remainingQty: newRemaining },
    });

    details.push({
      inventoryLayerId: layer.id,
      quantityConsumed: takeFromLayer,
      unitCost: layerUnitCost,
      totalCost: consumptionCost,
      layerRemainingAfter: newRemaining,
    });

    totalCost = totalCost.add(consumptionCost);
    remainingToConsume -= takeFromLayer;
  }

  return {
    success: true,
    totalCost,
    details,
  };
}

/**
 * Create new inventory layer from purchase or return
 */
export async function createInventoryLayer(
  tx: Prisma.TransactionClient,
  data: CreateLayerInput
): Promise<string> {
  const layer = await tx.inventoryLayer.create({
    data: {
      tenantId: data.tenantId,
      productId: data.productId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      quantity: data.quantity,
      remainingQty: data.quantity,
      unitCost: data.unitCost,
      totalCost: data.unitCost.mul(data.quantity),
      receivedDate: data.receivedDate,
    },
  });

  return layer.id;
}

/**
 * Restore inventory from sales return - creates NEW layer
 */
export async function restoreInventoryFromReturn(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
  quantity: number,
  totalCost: Decimal,
  saleReturnId: string,
  returnDate: Date
): Promise<string> {
  const unitCost = totalCost.div(quantity);

  return createInventoryLayer(tx, {
    tenantId,
    productId,
    sourceType: 'RETURN',
    sourceId: saleReturnId,
    quantity,
    unitCost,
    receivedDate: returnDate,
  });
}

/**
 * Reduce inventory layer for purchase return
 */
export async function reduceInventoryLayer(
  tx: Prisma.TransactionClient,
  inventoryLayerId: string,
  quantityToReturn: number
): Promise<{ success: boolean; error?: string }> {
  const layer = await tx.inventoryLayer.findUnique({
    where: { id: inventoryLayerId },
  });

  if (!layer) {
    return { success: false, error: 'Layer persediaan tidak ditemukan' };
  }

  if (layer.remainingQty < quantityToReturn) {
    return {
      success: false,
      error: `Tidak dapat meretur ${quantityToReturn}. Hanya ${layer.remainingQty} tersisa di layer`,
    };
  }

  await tx.inventoryLayer.update({
    where: { id: inventoryLayerId },
    data: {
      remainingQty: { decrement: quantityToReturn },
    },
  });

  return { success: true };
}

/**
 * Get current stock for a product
 */
export async function getProductStock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string
): Promise<{ quantity: number; value: Decimal }> {
  const layers = await tx.inventoryLayer.findMany({
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

/**
 * Calculate COGS to restore from a sale return
 * Uses average cost from original COGS details
 */
export async function calculateReturnCogs(
  tx: Prisma.TransactionClient,
  saleItemId: string,
  returnQuantity: number
): Promise<{ unitCost: Decimal; totalCost: Decimal }> {
  const cogsDetails = await tx.costOfGoodsDetail.findMany({
    where: { saleItemId },
  });

  if (cogsDetails.length === 0) {
    return { unitCost: new Decimal(0), totalCost: new Decimal(0) };
  }

  // Calculate average unit cost from COGS details
  const totalQty = cogsDetails.reduce((sum, d) => sum + d.quantity, 0);
  const totalCost = cogsDetails.reduce(
    (sum, d) => sum.add(new Decimal(d.totalCost.toString())),
    new Decimal(0)
  );

  const avgUnitCost = totalCost.div(totalQty);
  const returnTotalCost = avgUnitCost.mul(returnQuantity);

  return {
    unitCost: avgUnitCost,
    totalCost: returnTotalCost,
  };
}
