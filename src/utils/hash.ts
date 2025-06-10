import bcrypt from 'bcrypt';
import { config } from '../config/environment.js';

const saltRounds = config.bcrypt.saltRounds || 12;

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, saltRounds);
};

export const comparePasswords = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};
