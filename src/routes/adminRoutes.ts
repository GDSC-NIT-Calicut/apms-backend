import express from 'express';
import multer from 'multer';
import { UPLOADS_DIR } from '../utils/fileUtils.js';
import {
  bulkRegisterStudents,
  bulkRegisterFaculty,
  bulkRegisterEventOrganizers,
  bulkRemoveUsers,
  editStudentDetails,
  editFacultyDetails,
  editEventOrganizerDetails,
  editAdminDetails
} from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  validateEditStudentInput,
  validateEditFacultyInput,
  validateEditEventOrganizerInput,
  validateEditAdminInput
} from '../middleware/validators.js';

const upload = multer({ dest: UPLOADS_DIR });
const router = express.Router();

// Bulk register / remove routes (file upload)
// CSV parsing + row validation moved to controller.
// Routes only handle auth + file upload + call controller.
router.post(
  '/bulk-register/student',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  bulkRegisterStudents
);

router.post(
  '/bulk-register/faculty',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  bulkRegisterFaculty
);

router.post(
  '/bulk-register/event-organizer',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  bulkRegisterEventOrganizers
);

router.post(
  '/bulk-remove',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  bulkRemoveUsers
);

// Edit endpoints — email must be provided in req.body.email (not req.params)
// Validators run as route middleware.
router.patch(
  '/edit/student',
  authenticate,
  authorize('admin'),
  validateEditStudentInput,
  editStudentDetails
);

router.patch(
  '/edit/faculty',
  authenticate,
  authorize('admin'),
  validateEditFacultyInput,
  editFacultyDetails
);

router.patch(
  '/edit/event-organizer',
  authenticate,
  authorize('admin'),
  validateEditEventOrganizerInput,
  editEventOrganizerDetails
);

router.patch(
  '/edit/admin',
  authenticate,
  authorize('admin'),
  validateEditAdminInput,
  editAdminDetails
);

export default router;