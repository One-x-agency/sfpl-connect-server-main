// src/types/express.d.ts

import type { StaffRole } from '@/constants/user-role.js';

declare global {
  namespace Express {

    interface Request {
      validatedQuery?: any;
      id?: string;
      user?: { id: string; role?: StaffRole };
      storefront?: {
        customerId: string | null;
        guestCartId: string | null;
      };
      auth?: {
        isAdmin: boolean;
        userId?: string;
        customerId?: string;
        sessionId?: string;
      };
    }
  }
}

export {};
