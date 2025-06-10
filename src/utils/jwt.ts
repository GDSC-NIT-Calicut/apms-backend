import jwt from 'jsonwebtoken';
import ms from 'ms';
import { config } from '../config/environment.js';
import { JWTPayload } from '../types/index.js';

export const generateToken = (payload: JWTPayload): string => {
  const secret: jwt.Secret = config.jwt.secret;
  
  // Type assertion for valid time strings
  const expiresIn = config.jwt.expiresIn as ms.StringValue;
  
  // Convert to milliseconds then to seconds
  const expiresInSeconds = Math.floor(ms(expiresIn) / 1000);

  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
};

export const verifyToken = (token: string): JWTPayload => {
  const secret: jwt.Secret = config.jwt.secret;
  return jwt.verify(token, secret) as JWTPayload;
};
