export const getStudentDetailsQuery = `
  SELECT 
    s.roll_number, 
    s.student_name, 
    s.department, 
    s.program, 
    s.total_points, 
    s.department_level_points, 
    s.institute_level_points,
    s.fa_assigned_points, 
    s.graduation_eligible,
    fa.fa_name AS faculty_advisor_name
  FROM students s
  LEFT JOIN student_faculty_mapping sfm 
    ON s.roll_number = sfm.student_roll_number AND sfm.is_active = TRUE
  LEFT JOIN faculty_advisors fa 
    ON sfm.fa_id = fa.fa_id
  WHERE s.user_id = $1
`;
export const getStudentApprovedRequestsQuery = `
  SELECT * FROM student_points
  WHERE student_roll_number = $1 AND status = 'APPROVED'
  ORDER BY submission_date DESC
`;

export const getStudentRejectedRequestsQuery = `
  SELECT * FROM student_points
  WHERE student_roll_number = $1 AND status = 'REJECTED'
  ORDER BY submission_date DESC
`;

export const getStudentPendingRequestsQuery = `
  SELECT * FROM student_points
  WHERE student_roll_number = $1 AND status = 'PENDING'
  ORDER BY submission_date DESC
`;

export const getStudentProofDocumentQuery = `
  SELECT proof_document FROM student_points
  WHERE point_id = $1 AND student_roll_number = $2
`;

export const insertStudentPointRequestQuery = `
  INSERT INTO student_points
    (student_roll_number, event_name, event_type, proof_document, points, status, event_date)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING *
`;

export const getRejectedRequestByIdQuery = `
  SELECT * FROM student_points
  WHERE point_id = $1 AND student_roll_number = $2 AND status = 'REJECTED'
`;

export const updateRejectedStudentPointRequestQuery = `
  UPDATE student_points
  SET
    event_name = $1,
    event_type = $2,
    event_date = $3,
    points = $4,
    proof_document = $5,
    status = 'PENDING',
    rejection_reason = NULL,
    resubmitted = TRUE,
    submission_date = CURRENT_TIMESTAMP
  WHERE point_id = $6 AND student_roll_number = $7
  RETURNING *
`;

export const getStudentPointByIdQuery = `
  SELECT * FROM student_points
  WHERE point_id = $1 AND student_roll_number = $2
`;
