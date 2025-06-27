// src/routes/user.ts
import express from 'express';
import { getUserDetails } from '../controllers/userDetails.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected route - requires valid JWT
router.get('/me', authenticate, getUserDetails);

export default router;
