import express, { Request, Response, NextFunction } from 'express';
  import cors from 'cors';
  import helmet from 'helmet';
  import morgan from 'morgan';
  import { config } from './config/environment.js';
  import authRoutes from './routes/authRoutes.js';
  import registerRoutes from './routes/registerRoutes.js';
  import userDetailsRoutes from './routes/userDetailsRoutes.js';
  import eventOrganizerRoutes from './routes/eventOrganizerRoutes.js';
  import studentRoutes from './routes/studentRoutes.js';
  import facultyRoutes from './routes/facultyRoutes.js';
  import adminRoutes from './routes/adminRoutes.js';
  import cookieParser from 'cookie-parser';
  import { existsSync, mkdirSync } from 'fs';
  import path from 'path';
  import passport from './middleware/passport.js';
  import { ensureUploadsDir, UPLOADS_DIR } from './utils/fileUtils.js';

// Create directory if it doesn't exist
ensureUploadsDir(); // ensures uploads exists cross-platform
console.log(`Uploads directory: ${UPLOADS_DIR}`);

  const app = express();

  // Security middleware
  app.use(helmet({ crossOriginEmbedderPolicy: false }));

  // Logging middleware
  app.use(morgan('dev'));
  //cookie parser
  app.use(cookieParser());
  // CORS configuration
  app.use(cors({
    origin: config.cors.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));
  app.use(passport.initialize());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global middleware to normalize request body to lowercase and clean special characters/spaces
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Helper to normalize string: remove multiple spaces, collapse duplicate special chars, remove spaces around special chars
    const normalizeString = (str: string): string => {
      let result = str.trim();
      let previous;
      
      do {
        previous = result;
        // Replace multiple consecutive spaces with single space
        result = result.replace(/ +/g, ' ');
        // Replace multiple identical special/punctuation chars (with optional spaces between) with single
        result = result.replace(/([^\w\s])\s*\1+/g, '$1');
        // Remove spaces before special characters
        result = result.replace(/\s+([^\w\s])/g, '$1');
        // Remove spaces after special characters
        result = result.replace(/([^\w\s])\s+/g, '$1');
      } while (result !== previous);
      
      return result;
    };

    const convertValue = (value: any, key?: string): any => {
      // Skip password fields - they are case-sensitive and should not be lowercased
      if (key === 'password') {
        return value;
      }

      if (typeof value === 'string') {
        // Convert to lowercase, then normalize spaces and special characters
        return normalizeString(value.toLowerCase());
      }
      if (Array.isArray(value)) {
        return value.map((item) => convertValue(item, key));
      }
      if (value !== null && typeof value === 'object') {
        return Object.keys(value).reduce((acc, objKey) => {
          acc[objKey] = convertValue(value[objKey], objKey);
          return acc;
        }, {} as any);
      }
      return value;
    };

    // Normalize only req.body - query params and URL params are case-sensitive (OAuth, IDs, etc.)
    if (req.body && typeof req.body === 'object') {
      req.body = convertValue(req.body);
    }

    next();
  });

  // Request logging (custom, optional if you use morgan)
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      message: 'APMS Backend is running successfully!',
    });
  });

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/register',registerRoutes);
  app.use('/api/getuserdetails',userDetailsRoutes);
  app.use('/api/event-organizer', eventOrganizerRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/faculty',facultyRoutes);
  app.use('/api/admin',adminRoutes);



  export default app;
