import { Request, Response, NextFunction } from 'express';
import { LoginCredentials,isUserRole } from '../types/index.js';

export const validateLoginInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password,role } = req.body as LoginCredentials;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email,role and password are required' });
  }

  if (typeof email !== 'string' || typeof password !== 'string' ||typeof role !== 'string' ||
    !isUserRole(role)) {
    return res.status(400).json({ message: 'Invalid input types' });
  }

  if (!email.endsWith('@nitc.ac.in')) {
    return res.status(400).json({ message: 'Only NITC emails allowed' });
  }

  next();
};

export const validateRegisterInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password,role } = req.body as LoginCredentials;
  
  if (!email || !password||!role) {
    return res.status(400).json({ message: 'Email,role and password are required' });
  }

  if (typeof email !== 'string' || typeof password !== 'string' ||typeof role !== 'string' ||
    !isUserRole(role)) {
    return res.status(400).json({ message: 'Invalid input types' });
  }

  if (!email.endsWith('@nitc.ac.in')) {
    return res.status(400).json({ message: 'Only NITC emails allowed' });
  }

  next();
};