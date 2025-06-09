// src/types/express.d.ts
import { UserRole } from './index.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: number;
        email: string;
        role: UserRole;
      };
    }
  }
}
