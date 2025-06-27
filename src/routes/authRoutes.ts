import express from 'express';
import { loginController } from '../controllers/authController.js';
import { validateLoginInput,validateRegisterInput } from '../middleware/validators.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', validateLoginInput, loginController);

// (Optional) Add registration or other auth routes here
router.post('/logout', (req, res) => {
  // Clear token cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.status(200).json({ message: 'Logged out successfully' });
});


export default router;
