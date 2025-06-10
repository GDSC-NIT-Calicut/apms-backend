  import app from './app.js';
  import { config } from './config/environment.js';
  import{connectDB} from './config/database.js';

  const PORT = config.port;
  await connectDB();
  //we are using jwt token based auth so frontend must remove that upon logout from local storage
  const server = app.listen(PORT,() => {
    
    console.log('🚀 APMS Backend Server Started');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api`);
    console.log('⚡ Ready to accept connections');
  });


  //for login take email,passwd and role also(instead of only email and role to allow
  //person with same email to have multiple roles)