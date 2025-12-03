import { Request, Response } from 'express';
    import { generateToken } from '../utils/jwt.js';
    import { config } from '../config/environment.js';
    import ms from 'ms';

    export const loginController = async (req: Request, res: Response) => {
      try {
        const { email, password } = req.body;

        // Admin login (hardcoded)
        if (
          email === config.hardCodedAdmin.email &&
          password === config.hardCodedAdmin.password
        ) {
          const token = generateToken({
            user_id: -1,
            email: config.hardCodedAdmin.email,
            role: 'admin'
          });

          const expiresInMs = ms(config.jwt.expiresIn as ms.StringValue);
          if (!expiresInMs || isNaN(Number(expiresInMs))) {
            throw new Error('Invalid JWT_EXPIRES_IN format!');
          }

          const adminRedirectUrl = new URL('/dashboard/admin', config.frontendURL).toString();

          res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: expiresInMs,
            path: '/',
          });

          return res.redirect(adminRedirectUrl);
        }

        // other authentication flows (if any) go here
      } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    };

    // Google OAuth callback
    export const googleOAuthCallbackController = async (req: Request, res: Response) => {
    try {
      // 1. User already authenticated by Passport - req.user exists
      if (!req.user) {
        return res.status(401).json({ message: 'OAuth authentication failed' });
      }
      const dbUser = req.user as any; // Ensure user type

      // 2. Handle NITC domain check (redundant if already in strategy, but extra safe)
      if (!dbUser.email.endsWith('@nitc.ac.in')) {
        return res.status(403).json({ message: 'Only NITC emails allowed.' });
      }

     
      // 4. Generate JWT token
      const token = generateToken({
        user_id: dbUser.user_id,
        email: dbUser.email,
        role: dbUser.role,
      });
      const expiresInMs = ms(config.jwt.expiresIn as ms.StringValue);

      if (!expiresInMs || isNaN(Number(expiresInMs))) {
        return res.status(500).json({ message: 'Invalid JWT_EXPIRES_IN format!' });
      }
       const redirectUrl = new URL(`/dashboard/${dbUser.role}`, config.frontendURL).toString();

      // 5. Set cookie and redirect
       res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresInMs,
      path: '/',
    });

    return res.redirect(redirectUrl);
        //i think here redirection to frontend is required we have to give the dashboard url of frontend for each uder type depending on the user role
    } catch (error: any) {
      console.error('Google OAuth callback error:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };