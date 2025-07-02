import express from 'express';
import multer from 'multer';
import {
  viewApprovedRequests,
  viewRejectedRequests,
  viewPendingRequests,
  downloadProofDocument,
  submitRequest,
  resubmitRequest,
} from '../controllers/studentController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  validateSubmitStudentRequest,
  validateResubmitStudentRequest,
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
