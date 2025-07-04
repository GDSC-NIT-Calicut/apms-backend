import express from 'express';
import multer from 'multer';
import {
  viewPendingRequests,
  approveRequest,
  rejectRequest,
  downloadProofDocument,
  viewStudentStatus,
  assignActivityPoints,
} from '../controllers/facultyControllers.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  validateDownloadProofDocument,
} from '../middleware/validators.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
  },
});
const upload = multer({ storage });

// All routes require FA authentication
router.get(
  '/requests/pending',
  authenticate,
  authorize('faculty_advisor'),
  viewPendingRequests
);

router.post(
  '/requests/approve',
  authenticate,
  authorize('faculty_advisor'),
  approveRequest
);

router.post(
  '/requests/reject',
  authenticate,
  authorize('faculty_advisor'),
  rejectRequest
);

router.get(
  '/requests/proof',
  authenticate,
  authorize('faculty_advisor'),
  validateDownloadProofDocument,
  downloadProofDocument
);

router.get(
  '/students/status',
  authenticate,
  authorize('faculty_advisor'),
  viewStudentStatus
);

router.post(
  '/assign',
  authenticate,
  authorize('faculty_advisor'),
  assignActivityPoints
);

export default router;
