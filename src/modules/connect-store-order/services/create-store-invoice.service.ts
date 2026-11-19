import type { DatabaseClient } from '@/service/database/index.js';
import ServerError from '@/core/serverError.class.js';

const GST_INCLUSIVE_FACTOR = 1.18;

export const SFPL_INVOICE_SELLER = {
  gstin: '24ABMCS2003B1ZZ',
  stateCode: '24',
};

export type InvoiceChargeType = 'CGST' | 'SGST' | 'IGST';

export type InvoiceCharge = {
  type: InvoiceChargeType;
  rate: number;
  amount_in_paisa: number;
};

export type InvoiceItem = {
  plan_id: string;
  plan_name: string;
  hsn_sac: string | null;
  quantity: number;
  price_in_paisa: number;
  taxable_amount_in_paisa: number;
  tax_amount_in_paisa: number;
  total_amount_in_paisa: number;
};

type OrderItemRow = {
  device_id: string;
  device_name: string;
  hsn_sac: string | null;
  quantity: number;
  price_in_paisa: number;
};

type OrderRow = {
  id: string;
  serial: string | null;
  total_amount_in_paisa: number;
  billing_details: Record<string, unknown>;
  billing_address: Record<string, unknown>;
  shipping_address: Record<string, unknown>;
};

function exclusivePaisa(grossPaisa: number) {
  return Math.round(Number(grossPaisa) / GST_INCLUSIVE_FACTOR);
}

/** Force money to whole paisa (never leave float dust like 122.333…). */
function roundPaisa(value: number) {
  return Math.round(Number(value) || 0);
}

function readStateGstCode(address: Record<string, unknown> | null | undefined) {
  if (!address || typeof address !== 'object') return '';
  const code = address.state_gst_code;
  return typeof code === 'string' ? code.trim() : '';
}

function readStateName(address: Record<string, unknown> | null | undefined) {
  if (!address || typeof address !== 'object') return '';
  const name = address.state_name;
  return typeof name === 'string' ? name.trim() : '';
}

function buildCharges(totalPaisa: number, placeOfSupplyGstCode: string) {
  const isInterState = placeOfSupplyGstCode !== SFPL_INVOICE_SELLER.stateCode;
  const gross = roundPaisa(totalPaisa);
  let taxable = exclusivePaisa(gross);
  let tax = roundPaisa(gross - taxable);

  if (isInterState) {
    const charges: InvoiceCharge[] = [
      { type: 'IGST', rate: 18, amount_in_paisa: tax },
    ];
    return { isInterState, taxable, tax, charges };
  }

  // Same rate → same amount. Odd leftover paisa is absorbed into taxable
  // so CGST/SGST stay equal and grand total still matches order total.
  const half = Math.floor(tax / 2);
  const remainder = tax - half * 2;
  taxable = roundPaisa(taxable + remainder);
  tax = roundPaisa(half * 2);
  const charges: InvoiceCharge[] = [
    { type: 'CGST', rate: 9, amount_in_paisa: half },
    { type: 'SGST', rate: 9, amount_in_paisa: half },
  ];
  return { isInterState, taxable, tax, charges };
}

function buildInvoiceItems(
  orderItems: OrderItemRow[],
  orderTaxable: number,
): InvoiceItem[] {
  const targetTaxable = roundPaisa(orderTaxable);
  const items: InvoiceItem[] = orderItems.map((item) => {
    const total = roundPaisa(item.price_in_paisa * item.quantity);
    const taxable = exclusivePaisa(total);
    return {
      plan_id: item.device_id,
      plan_name: item.device_name,
      hsn_sac: item.hsn_sac,
      quantity: item.quantity,
      price_in_paisa: roundPaisa(item.price_in_paisa),
      taxable_amount_in_paisa: taxable,
      tax_amount_in_paisa: roundPaisa(total - taxable),
      total_amount_in_paisa: total,
    };
  });

  const lineTaxableTotal = items.reduce((sum, item) => sum + item.taxable_amount_in_paisa, 0);
  if (items.length > 0 && lineTaxableTotal !== targetTaxable) {
    const last = items[items.length - 1]!;
    const delta = targetTaxable - lineTaxableTotal;
    last.taxable_amount_in_paisa = roundPaisa(last.taxable_amount_in_paisa + delta);
    last.tax_amount_in_paisa = roundPaisa(
      last.total_amount_in_paisa - last.taxable_amount_in_paisa,
    );
  }

  return items;
}

/** YYMM from Asia/Kolkata (e.g. Jul 2026 → 2607). */
function getInvoiceYymm(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: '2-digit',
    month: '2-digit',
  }).formatToParts(date);
  const yy = parts.find((p) => p.type === 'year')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'month')?.value ?? '01';
  return Number(`${yy}${mm}`);
}

/**
 * Serial = YYMM + 4-digit series.
 * Example: SFPL-INV-26070015
 * Each new invoice increases the series by a random 1–10 (not always +1).
 */
async function allocateInvoiceSerialNumber(db: DatabaseClient) {
  const yymm = getInvoiceYymm();
  const prefixMin = yymm * 10000;
  const prefixMax = yymm * 10000 + 9999;
  const lockKey = 740_000_000 + yymm;

  await db.query('SELECT pg_advisory_lock($1)', [lockKey]);
  try {
    const row = await db.queryOne<{ max_serial: number | null }>(
      `SELECT MAX(serial_number) AS max_serial
       FROM invoices
       WHERE serial_number >= $1 AND serial_number <= $2`,
      [prefixMin, prefixMax],
    );

    const lastSeries = row?.max_serial != null ? row.max_serial % 10000 : 0;
    const step = 1 + Math.floor(Math.random() * 10); // 1..10
    const nextSeries = lastSeries + step;
    if (nextSeries > 9999) {
      throw new ServerError('Invoice serial series exhausted for this month');
    }
    return prefixMin + nextSeries;
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [lockKey]);
  }
}

export async function createStoreInvoiceForOrder(db: DatabaseClient, orderId: string) {
  const existing = await db.queryOne(
    `SELECT id, serial, order_id, order_number, issued_at, status,
            billing_details, billing_address, shipping_address,
            place_of_supply_state_name, place_of_supply_gst_code, is_inter_state,
            items, charges, taxable_amount_in_paisa, tax_amount_in_paisa, total_amount_in_paisa,
            seller_gstin, seller_state_gst_code, created_at, updated_at
     FROM invoices
     WHERE order_id = $1`,
    [orderId],
  );
  if (existing) return existing;

  const order = await db.queryOne<OrderRow>(
    `SELECT
      id,
      serial,
      total_amount_in_paisa,
      billing_details,
      billing_address,
      shipping_address
     FROM connect_store_orders
     WHERE id = $1`,
    [orderId],
  );
  if (!order) throw new ServerError('Order not found');
  if (!order.serial) throw new ServerError('Order must have a serial before creating an invoice');

  const orderItems = await db.queryAll<OrderItemRow>(
    `SELECT device_id, device_name, hsn_sac, quantity, price_in_paisa
     FROM connect_store_order_items
     WHERE order_id = $1
     ORDER BY id`,
    [orderId],
  );
  if (!orderItems.length) throw new ServerError('Order has no items to invoice');

  // Place of supply for goods = delivery (shipping) state, not billing.
  const placeOfSupplyGstCodeRaw = readStateGstCode(order.shipping_address);
  const placeOfSupplyStateName = readStateName(order.shipping_address) || 'Unknown';
  const placeOfSupplyGstCode = (placeOfSupplyGstCodeRaw || '00').slice(0, 2);

  const { isInterState, taxable, tax, charges } = buildCharges(
    order.total_amount_in_paisa,
    placeOfSupplyGstCodeRaw,
  );
  const items = buildInvoiceItems(orderItems, taxable);
  const totalAmount = roundPaisa(order.total_amount_in_paisa);
  const serialNumber = await allocateInvoiceSerialNumber(db);

  const invoice = await db.queryOne(
    `INSERT INTO invoices (
      order_id,
      order_number,
      serial_number,
      billing_details,
      billing_address,
      shipping_address,
      place_of_supply_state_name,
      place_of_supply_gst_code,
      is_inter_state,
      items,
      charges,
      taxable_amount_in_paisa,
      tax_amount_in_paisa,
      total_amount_in_paisa,
      seller_gstin,
      seller_state_gst_code
    ) VALUES (
      $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb,
      $7, $8, $9,
      $10::jsonb, $11::jsonb,
      $12, $13, $14,
      $15, $16
    )
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id, serial, order_id, order_number, issued_at, status,
      billing_details, billing_address, shipping_address,
      place_of_supply_state_name, place_of_supply_gst_code, is_inter_state,
      items, charges, taxable_amount_in_paisa, tax_amount_in_paisa, total_amount_in_paisa,
      seller_gstin, seller_state_gst_code, created_at, updated_at`,
    [
      order.id,
      order.serial,
      serialNumber,
      JSON.stringify(order.billing_details ?? {}),
      JSON.stringify(order.billing_address ?? {}),
      JSON.stringify(order.shipping_address ?? {}),
      placeOfSupplyStateName,
      placeOfSupplyGstCode,
      isInterState,
      JSON.stringify(items),
      JSON.stringify(charges),
      taxable,
      tax,
      totalAmount,
      SFPL_INVOICE_SELLER.gstin,
      SFPL_INVOICE_SELLER.stateCode,
    ],
  );

  if (invoice) return invoice;

  const raced = await db.queryOne(
    `SELECT id, serial, order_id, order_number, issued_at, status,
            billing_details, billing_address, shipping_address,
            place_of_supply_state_name, place_of_supply_gst_code, is_inter_state,
            items, charges, taxable_amount_in_paisa, tax_amount_in_paisa, total_amount_in_paisa,
            seller_gstin, seller_state_gst_code, created_at, updated_at
     FROM invoices
     WHERE order_id = $1`,
    [orderId],
  );
  if (!raced) throw new ServerError('Failed to create invoice');
  return raced;
}
