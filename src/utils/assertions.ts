import { Request } from 'express';
import { User } from '../types/index.js';

export function assertHasUser(req: Request): asserts req is Request & { user: User } {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
}
