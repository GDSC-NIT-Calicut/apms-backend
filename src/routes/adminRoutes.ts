import express from 'express';
import multer from 'multer';
import { UPLOADS_DIR } from '../utils/fileUtils.js';
import * as adminController from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const upload = multer({ dest: UPLOADS_DIR }); // use absolute dir, cross-platform
const router = express.Router();

//also in csv files order of columns is important
router.post(
  '/bulk-register/student',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  adminController.bulkRegisterStudents
);

router.post(
  '/bulk-register/faculty',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  adminController.bulkRegisterFaculty
);

router.post(
  '/bulk-register/event-organizer',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  adminController.bulkRegisterEventOrganizers
);

router.post(
  '/bulk-remove',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  adminController.bulkRemoveUsers
);

//req.params is used for email other data is in body(i.e fields to be edited)
//also remember to set header for content-type application/json
//ex url http://localhost:3000/api/admin/edit/student/student1@nitc.ac.in
//frontend must url encode this
//   like const email = 'student1@nitc.ac.in';
// const encodedEmail = encodeURIComponent(email); // 'student1%40nitc.ac.in'
// const url = `/api/admin/edit/student/${encodedEmail}`;

router.patch(
  '/edit/student/:email',
  authenticate,
  authorize('admin'),
  adminController.editStudentDetails
);

//req.params is used for email other data is in body(i.e fields to be edited)
router.patch(
  '/edit/faculty/:email',
  authenticate,
  authorize('admin'),
  adminController.editFacultyDetails
);

//req.params is used for email other data is in body(i.e fields to be edited)
router.patch(
  '/edit/event-organizer/:email',
  authenticate,
  authorize('admin'),
  adminController.editEventOrganizerDetails
);

//req.params is used for email other data is in body(i.e fields to be edited )
router.patch(
  '/edit/admin/:email',
  authenticate,
  authorize('admin'),
  adminController.editAdminDetails
);

export default router;
