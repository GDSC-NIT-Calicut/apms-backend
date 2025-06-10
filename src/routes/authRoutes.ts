import express from 'express';
import { loginController,registerController } from '../controllers/authController.js';
import { validateLoginInput,validateRegisterInput } from '../middleware/validators.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', validateLoginInput, loginController);

// (Optional) Add registration or other auth routes here
router.post('/register', validateRegisterInput, registerController);

export default router;
