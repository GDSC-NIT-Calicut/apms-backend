// =========================================================================
// FIXED FACULTY ADVISOR DATABASE QUERIES
// =========================================================================

// 1. Fixed Pending Requests Query (Added FA table join & Aliased fields for your Frontend)
export const getFacultyDetailsQuery = `
  SELECT f.fa_id, f.fa_name, f.department
  FROM faculty_advisors f
  WHERE f.user_id = $1
`;
export const getFAPendingRequestsQuery = `
SELECT 
    sp.point_id,
    sp.student_roll_number,
    sp.event_name AS activity_name,             -- 🌟 Aliased to match frontend template
    sp.points AS points_awarded,                 -- 🌟 Aliased to match frontend template
    sp.event_date,
    sp.submission_date,
    sp.status,
    s.student_name, 
    s.roll_number, 
    s.department, 
    s.program,
    sp.rejection_reason AS previous_rejection_reason
FROM faculty_advisors fa
JOIN student_faculty_mapping sfm ON fa.fa_id = sfm.fa_id
JOIN students s ON LOWER(sfm.student_roll_number) = LOWER(s.roll_number)
JOIN student_points sp ON LOWER(sp.student_roll_number) = LOWER(s.roll_number)
WHERE fa.user_id = $1                            --  Direct user_id check
  AND sfm.is_active = TRUE
  AND sp.status = 'PENDING'
ORDER BY sp.submission_date DESC
`;

// 2. Fixed Approve Query (Jumps through faculty_advisors via user_id)
export const approveStudentPointRequestQuery = `
UPDATE student_points
SET status = 'APPROVED', resubmitted = FALSE
WHERE point_id = $1
  AND LOWER(student_roll_number) IN (
    SELECT LOWER(sfm.student_roll_number) 
    FROM student_faculty_mapping sfm
    JOIN faculty_advisors fa ON sfm.fa_id = fa.fa_id
    WHERE fa.user_id = $2 AND sfm.is_active = TRUE
  )
RETURNING *
`;

// 3. Fixed Reject Query (Jumps through faculty_advisors via user_id)
export const rejectStudentPointRequestQuery = `
UPDATE student_points
SET status = 'REJECTED', rejection_reason = $2, resubmitted = FALSE
WHERE point_id = $1
  AND LOWER(student_roll_number) IN (
    SELECT LOWER(sfm.student_roll_number) 
    FROM student_faculty_mapping sfm
    JOIN faculty_advisors fa ON sfm.fa_id = fa.fa_id
    WHERE fa.user_id = $3 AND sfm.is_active = TRUE
  )
RETURNING *
`;

// --- The rest of your utility queries remain unchanged ---
export const getFADownloadProofDocumentQuery = `
SELECT proof_document FROM student_points WHERE point_id = $1
`;

export const getFAStudentStatusQuery = `
SELECT 
    s.student_name, 
    s.roll_number, 
    COALESCE(s.total_points, 0) AS total_points,                -- 🌟 Added Defensive Coalesce
    COALESCE(s.institute_level_points, 0) AS institute_level_points,   -- 🌟 Added Defensive Coalesce
    COALESCE(s.department_level_points, 0) AS department_level_points, -- 🌟 Added Defensive Coalesce
    COALESCE(s.fa_assigned_points, 0) AS fa_assigned_points,           -- 🌟 Added Defensive Coalesce
    s.graduation_eligible
FROM faculty_advisors fa
JOIN student_faculty_mapping sfm ON fa.fa_id = sfm.fa_id
JOIN students s ON sfm.student_roll_number = s.roll_number
WHERE fa.user_id = $1 AND sfm.is_active = TRUE
ORDER BY s.roll_number
`;

export const getStudentByRollNumberQuery = `
SELECT * FROM students WHERE roll_number = $1
`;

export const checkFADuplicateEventQuery = `
SELECT 1 FROM student_points
WHERE student_roll_number = $1 AND event_name = $2 AND event_date = $3 AND event_type = 'fa_assigned'
`;

export const insertFAAssignedPointsQuery = `
INSERT INTO student_points
  (student_roll_number, event_name, event_type, event_date, points, status, submission_date, resubmitted)
VALUES
  ($1, $2, 'fa_assigned', $3, $4, 'APPROVED', NOW(), FALSE)
RETURNING *
`;