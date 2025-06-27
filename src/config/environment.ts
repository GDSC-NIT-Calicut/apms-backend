import dotenv from 'dotenv';
import { DatabaseError } from 'pg';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  },
  hardCodedAdmin: {
    email: process.env.HARD_CODED_ADMIN_EMAIL!,
    password: process.env.HARD_CODED_ADMIN_PASSWORD!,
    name: process.env.HARD_CODED_ADMIN_NAME!,
  },
};
