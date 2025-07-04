  import express, { Request, Response, NextFunction } from 'express';
  import cors from 'cors';
  import helmet from 'helmet';
  import morgan from 'morgan';
  import { config } from './config/environment.js';
  //import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
  import authRoutes from './routes/authRoutes.js';
  import registerRoutes from './routes/registerRoutes.js';
  import userDetailsRoutes from './routes/userDetailsRoutes.js';
  import eventOrganizerRoutes from './routes/eventOrganizerRoutes.js';
  import studentRoutes from './routes/studentRoutes.js';
  import facultyRoutes from './routes/facultyRoutes.js';
  import cookieParser from 'cookie-parser';
  import { existsSync, mkdirSync } from 'fs';
  import path from 'path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Create directory if it doesn't exist
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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

          registerstudent: 'POST /api/register/student',
          registerfa:'POST /api/register/fa',
          registerevent_organizer:'POST /api/register/event_organizer',
          registeradmin:'POST /api/register/admin',
          login: 'POST /api/auth/login', //only raw json
          logout: 'POST /api/auth/logout',
          //refresh: 'POST /api/auth/refresh',
          //profile: 'GET /api/auth/profile',
          //validate: 'GET /api/auth/validate',
          getUserDetailsforalreadylogineduser: 'GET /api/getuserdetails/me',
          evnetorganizerallocatepoints:'POST /api/event-organizer/allocate',
          eventOrganizerreallocatepoints:'PUT /api/event-organizer/reallocate',
          eventOrganizerreallocatedetails:'PUT /api/event-organizer/reallocate/details',
          eventOrganizerrevokeallocation:'POST /api/event-organizer/revoke',
          eventOrganizerRoutesviewallocatedallocation:'GET /api/event-organizer/allocations/allocated',
          eventOrganizerRoutesviewrevokedallocation:'GET /api/event-organizer/allocations/revoked',
          eventorganizergetuploadedfileforallocatedorrevokedallocations:'GET /api/event-organizer/allocations/file',
          studentsgetapprovedrequest:'GET /api/student/requests/approved',
          //remember for students the form for submit or resubmit the name of the file section must be proof
          studentsgetrejectedrequest:'GET /api/student/requests/rejected',
          studentsgetpendingrequest:'GET /api/student/requests/pending',
          studentsubmitactivity:'POST /api/student/requests/submit',
          studentresubmitactivity:'POST /api/student/requests/resubmit',
          studentviewuploadeddocument:'GET /api/student/requests/proof'
          //we will use local storage for storing jwt and for user who already has valid jwt
          //this needs to be checked by frontend and is there is no need for user to login again
          //the frontend can hit this route to get the dashboard data directly without the
          //user having to reenter their credentials this is valid for goolge o auth also
          //confirm this

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
  app.use('/api/auth', authRoutes);//later after all routes development change auth to use google o auth
  app.use('/api/register',registerRoutes);
  app.use('/api/getuserdetails',userDetailsRoutes);
  app.use('/api/event-organizer', eventOrganizerRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/faculty',facultyRoutes);
  //app.use('/api/users', userRoutes);
  // app.use('/api/students', studentRoutes); // Add more as needed

  // 404 handler
  //app.use('*', notFoundHandler);

  // Error handler
  //app.use(errorHandler);

  export default app;
