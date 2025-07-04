export const getFacultyDetailsQuery = `
  SELECT f.fa_id, f.fa_name, f.department
  FROM faculty_advisors f
  WHERE f.user_id = $1
`;
// --- Pending Requests for FA ---
export const getFAPendingRequestsQuery = `
SELECT sp.*, s.student_name, s.roll_number, s.department, s.program,
       sp.rejection_reason AS previous_rejection_reason
FROM student_faculty_mapping sfm
JOIN students s ON sfm.student_roll_number = s.roll_number
JOIN student_points sp ON sp.student_roll_number = s.roll_number
WHERE sfm.fa_id = $1
  AND sp.status = 'PENDING'
ORDER BY sp.submission_date DESC
`;

// --- Approve Request ---
export const approveStudentPointRequestQuery = `
UPDATE student_points
SET status = 'APPROVED', resubmitted = FALSE
WHERE point_id = $1
  AND student_roll_number IN (
    SELECT student_roll_number FROM student_faculty_mapping WHERE fa_id = $2
  )
RETURNING *
`;

// --- Reject Request ---
export const rejectStudentPointRequestQuery = `
UPDATE student_points
SET status = 'REJECTED', rejection_reason = $2, resubmitted = FALSE
WHERE point_id = $1
  AND student_roll_number IN (
    SELECT student_roll_number FROM student_faculty_mapping WHERE fa_id = $3
  )
RETURNING *
`;

// --- Get Proof Document Path ---
export const getFADownloadProofDocumentQuery = `
SELECT proof_document FROM student_points
WHERE point_id = $1
`;

// --- View Status of All Students Assigned to FA ---
export const getFAStudentStatusQuery = `
SELECT s.student_name, s.roll_number, s.total_points,
       s.institute_level_points, s.department_level_points, s.fa_assigned_points,s.graduation_eligible
FROM student_faculty_mapping sfm
JOIN students s ON sfm.student_roll_number = s.roll_number
WHERE sfm.fa_id = $1
ORDER BY s.roll_number
`;

// --- Check Student Exists ---
export const getStudentByRollNumberQuery = `
SELECT * FROM students WHERE roll_number = $1
`;

// --- Check Duplicate FA-Assigned Event ---
export const checkFADuplicateEventQuery = `
SELECT 1 FROM student_points
WHERE student_roll_number = $1
  AND event_name = $2
  AND event_date = $3
  AND event_type = 'fa_assigned'
`;

// --- Insert FA-Assigned Points ---
export const insertFAAssignedPointsQuery = `
INSERT INTO student_points
  (student_roll_number, event_name, event_type, event_date, points, status, submission_date, resubmitted)
VALUES
  ($1, $2, 'fa_assigned', $3, $4, 'APPROVED', NOW(), FALSE)
RETURNING *
`;
