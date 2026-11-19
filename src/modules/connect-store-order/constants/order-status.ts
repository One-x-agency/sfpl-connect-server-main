export const ORDER_STATUSES = [
  'pending',
  'processing',
  'out_for_delivery',
  'delivered',
  'complete',
  'cancel',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['complete', 'cancel'];

export const ORDER_OTP_PURPOSES = ['delivered', 'complete'] as const;

export type OrderOtpPurpose = (typeof ORDER_OTP_PURPOSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Placed',
  processing: 'Processing',
  out_for_delivery: 'Shipping',
  delivered: 'Delivered',
  complete: 'Complete',
  cancel: 'Cancelled',
};

export const TRANSITION_FROM_STATUS: Record<string, OrderStatus> = {
  processing: 'pending',
  shipping: 'processing',
  delivered: 'out_for_delivery',
  complete: 'delivered',
};
