// src/types/express.d.ts
import { UserRole } from './index';

declare global {
  namespace Express {
    interface User {
      user_id: number;
      email: string;
      role: UserRole;
    }
    interface Request {
      user?: User;
    }
  }
}
