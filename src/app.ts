  import express, { Request, Response, NextFunction } from 'express';
  import cors from 'cors';
  import helmet from 'helmet';
  import morgan from 'morgan';
  import { config } from './config/environment.js';
  //import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
  import authRoutes from './routes/authRoutes.js';
  //import userRoutes from './routes/userRoutes';
  // import other routes as needed

  const app = express();

  // Security middleware
  app.use(helmet({ crossOriginEmbedderPolicy: false }));

  // Logging middleware
  app.use(morgan('dev'));

  // CORS configuration
  app.use(cors({
    origin: config.cors.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  // API documentation endpoint
  app.get('/api', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'APMS API v1.0',
      endpoints: {
        auth: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          logout: 'POST /api/auth/logout',
          refresh: 'POST /api/auth/refresh',
          profile: 'GET /api/auth/profile',
          validate: 'GET /api/auth/validate',
          //also remember upon logout the jwt token must be removed by the frontend or otherwise it will stay there until expiration time 
        },
      //   users: {
      //     list: 'GET /api/users',
      //     profile: 'GET /api/users/:id',
      //   },
      },
    });
  });

  // Mount routes
  app.use('/api/auth', authRoutes);
  //app.use('/api/users', userRoutes);
  // app.use('/api/students', studentRoutes); // Add more as needed

  // 404 handler
  //app.use('*', notFoundHandler);

  // Error handler
  //app.use(errorHandler);

  export default app;
