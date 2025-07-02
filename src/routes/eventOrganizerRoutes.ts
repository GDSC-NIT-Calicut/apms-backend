import express from 'express';
import multer from 'multer';
import { 
  allocatePoints,
  getAllocatedAllocations,
  getRevokedAllocations,
  downloadAllocationFile,
  revokeAllocation,
  reallocatePoints,
  updateAllocationDetails
} from '../controllers/eventOrganizerController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  validateAllocatePointsInput,
  validateReallocatePointsInput,
  validateUpdateAllocationDetailsInput,
  validateRevokeAllocationInput,
  validateDownloadAllocationFileInput
} from '../middleware/validators.js';

const router = express.Router();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({ storage });
//cookie is must for all these routes

// --- POST /allocate ---
router.post(
  '/allocate',
  authenticate,
  authorize('event_organizer'),
  upload.single('file'),
  validateAllocatePointsInput,
  allocatePoints
);

// --- PUT /reallocate (file and/or details) ---
//form data form (file is there along wiht allocation_id) and cookie
router.put(
  '/reallocate',
  authenticate,
  authorize('event_organizer'),
  upload.single('file'),
  validateReallocatePointsInput,
  reallocatePoints
);

// --- PUT /reallocate/details (details only) ---
//raw json or form also acceptable
router.put(
  '/reallocate/details',
  authenticate,
  authorize('event_organizer'),
  validateUpdateAllocationDetailsInput,
  updateAllocationDetails
);

// --- POST /revoke ---
//raw json format (but maybe can be sent in form also but not possible as request query)
router.post(
  '/revoke',
  authenticate,
  authorize('event_organizer'),
  validateRevokeAllocationInput,
  revokeAllocation
);

// --- GET /allocations/allocated ---
//just cookie inclusion in enough
router.get(
  '/allocations/allocated',
  authenticate,
  authorize('event_organizer'),
  getAllocatedAllocations
);

// --- GET /allocations/revoked ---
//cookie is required
router.get(
  '/allocations/revoked',
  authenticate,
  authorize('event_organizer'),
  getRevokedAllocations
);

// --- GET /allocations/file?allocation_id=... ---
//allocation id in the form of req query
router.get(
  '/allocations/file',
  authenticate,
  authorize('event_organizer'),
  validateDownloadAllocationFileInput,
  downloadAllocationFile
);

export default router;
