import express from 'express';
import multer from 'multer';
import path from 'path';
import { UPLOADS_DIR } from '../utils/fileUtils.js';

// middleware & validators
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  validateDownloadProofDocument,
  validateSubmitStudentRequest,
  validateResubmitStudentRequest
} from '../middleware/validators.js';

// controllers
import {
  viewApprovedRequests,
  viewRejectedRequests,
  viewPendingRequests,
  downloadProofDocument,
  submitRequest,
  resubmitRequest
} from '../controllers/studentController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `student-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

// All routes require student authentication
router.get('/requests/approved', authenticate, authorize('student'), viewApprovedRequests);
router.get('/requests/rejected', authenticate, authorize('student'), viewRejectedRequests);
router.get('/requests/pending', authenticate, authorize('student'), viewPendingRequests);

router.get(
  '/requests/proof',
  authenticate,
  authorize('student'),
  validateDownloadProofDocument,
  downloadProofDocument
);

// Submit new request (multipart/form-data for PDF)
router.post(
  '/requests/submit',
  authenticate,
  authorize('student'),
  upload.single('proof'),
  validateSubmitStudentRequest,
  submitRequest
);

// Resubmit rejected request (edit fields, optional new file)
router.put(
  '/requests/resubmit',
  authenticate,
  authorize('student'),
  upload.single('proof'),
  validateResubmitStudentRequest,
  resubmitRequest
);

export default router;
