import express from 'express';
import { loginController, googleOAuthCallbackController } from '../controllers/authController.js';
import { validateLoginInput } from '../middleware/validators.js';
import { config } from '../config/environment.js';
import passport from '../middleware/passport.js';

const router = express.Router();

// Manual login (admin or NITC users by password)
router.post('/login', validateLoginInput, loginController);

// Google OAuth2 popup flow
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

const failureRedirectUrl = new URL('/failuresigninwithgoogle', config.frontendURL).toString();

router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: failureRedirectUrl // Frontend URL + /failuresigninwithgoogle
  }),
  googleOAuthCallbackController
);


router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
