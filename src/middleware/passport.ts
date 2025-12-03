import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { query } from '../database/index.js';
import { getUserByEmailAndRoleQuery } from '../database/queries/authQueries.js';
import { config } from '../config/environment.js';

// Use credentials from config/environment
const { clientID, clientSecret, callbackURL } = config.googleOAuth;

passport.use(
  new GoogleStrategy(
    { clientID, clientSecret, callbackURL },
    async (_accessToken, _refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      if (!email || !email.endsWith('@nitc.ac.in')) {
        return done(null, false, { message: 'Only NITC emails allowed.' });
      }
      const userResult = await query(
        "SELECT user_id, email, role FROM users WHERE email = $1",
        [email]
      );
      const user = userResult.rows[0];
      if (!user) {
        return done(null, false, { message: 'Email not registered.' });
      }
      return done(null, user); // Use a lean user object here
    }
  )
);


passport.serializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user));
passport.deserializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user));

export default passport;
