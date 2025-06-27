import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  registerStudentController,
  registerAdminController,
  registerEventOrganizerController,
  registerFacultyAdvisorController
} from '../controllers/registerController.js';
import {
  validateRegisterInput,
  validateStudentFields,
  validateAdminFields,
  validateEventOrganizerFields,
  validateFacultyAdvisorFields
} from '../middleware/validators.js';

const router = express.Router();

// Student registration
router.post(
  '/student',
  authenticate,
  authorize('admin'),
  validateRegisterInput,
  validateStudentFields,
  registerStudentController
);

// Admin registration
router.post(
  '/admin',
  authenticate,
  authorize('admin'),
  validateRegisterInput,
  validateAdminFields,
  registerAdminController
);

// Event Organizer registration
router.post(
  '/event_organizer',
  authenticate,
  authorize('admin'),
  validateRegisterInput,
  validateEventOrganizerFields,
  registerEventOrganizerController
);

// Faculty Advisor registration
router.post(
  '/fa',
  authenticate,
  authorize('admin'),
  validateRegisterInput,
  validateFacultyAdvisorFields,
  registerFacultyAdvisorController
);

export default router;
