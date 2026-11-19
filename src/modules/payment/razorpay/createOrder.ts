import axios from 'axios';
import env from '@/config/env.js';
import ServerError from '@/core/serverError.class.js';

const RAZORPAY_API_BASE_URL = 'https://api.razorpay.com/v1';
const RAZORPAY_REQUEST_TIMEOUT_MS = 15_000;

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

type CreateRazorpayOrderInput = {
  amountInPaisa: number;
  receipt: string;
  notes?: Record<string, string>;
};

function getRazorpayAuth() {
  const keyId = env.razorpay.keyId?.trim();
  const keySecret = env.razorpay.keySecret?.trim();

  if (!keyId || !keySecret) {
    return null;
  }

  return { keyId, keySecret };
}

function getRazorpayErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Payment gateway request failed';
  }

  if (error.code === 'ECONNABORTED') {
    return 'Payment gateway timed out. Please try again.';
  }

  const razorpayError = error.response?.data?.error;
  if (razorpayError?.description) {
    return razorpayError.description;
  }
  if (razorpayError?.reason) {
    return razorpayError.reason;
  }
  if (error.message) {
    return error.message;
  }

  return 'Payment gateway request failed';
}

export function isRazorpayConfigured() {
  return Boolean(getRazorpayAuth());
}

export async function createRazorpayOrder(input: CreateRazorpayOrderInput): Promise<RazorpayOrder> {
  const auth = getRazorpayAuth();
  if (!auth) {
    throw new ServerError('Payment gateway is not configured');
  }

  const amount = Math.round(input.amountInPaisa);
  if (amount < 100) {
    throw new ServerError('Order amount must be at least ₹1');
  }

  const receipt = input.receipt.trim().slice(0, 40);
  if (!receipt) {
    throw new ServerError('Invalid payment receipt');
  }

  try {
    const { data } = await axios.post<RazorpayOrder>(
      `${RAZORPAY_API_BASE_URL}/orders`,
      {
        amount,
        currency: 'INR',
        receipt,
        notes: input.notes,
      },
      {
        auth: {
          username: auth.keyId,
          password: auth.keySecret,
        },
        timeout: RAZORPAY_REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return data;
  } catch (error) {
    throw new ServerError(getRazorpayErrorMessage(error));
  }
}
