export const getAdminDetailsQuery = `
  SELECT a.admin_id, a.admin_name
FROM admins a
WHERE a.user_id = $1

`;

export const removeUserByEmailQuery = `
  DELETE FROM users WHERE email = $1
`;

export const getUserByEmailQuery = `
  SELECT user_id, role FROM users WHERE email = $1
`;

export const getFacultyAdvisorByUserIdQuery = `
  SELECT fa_id, department FROM faculty_advisors WHERE user_id = $1
`;

export const getDummyFAForDepartmentQuery = `
  SELECT fa_id FROM faculty_advisors fa
  JOIN users u ON fa.user_id = u.user_id
  WHERE fa.fa_name = 'No FA Assigned' AND fa.department = $1 AND u.email = '[email,protected]'
`;

export const editStudentByUserIdQuery = `
  UPDATE students SET
    student_name = COALESCE($1, student_name),
    department = COALESCE($2, department),
    roll_number = COALESCE($3, roll_number),
    program = COALESCE($4, program),
    batch_year = COALESCE($5, batch_year)
  WHERE user_id = $6
  RETURNING *
`;

export const editFacultyByUserIdQuery = `
  UPDATE faculty_advisors SET
    fa_name = COALESCE($1, fa_name),
    department = COALESCE($2, department)
  WHERE user_id = $3
  RETURNING *
`;

export const editEventOrganizerByUserIdQuery = `
  UPDATE event_organizers SET
    organizer_name = COALESCE($1, organizer_name),
    organization_name = COALESCE($2, organization_name)
  WHERE user_id = $3
  RETURNING *
`;

export const editAdminByUserIdQuery = `
  UPDATE admins SET
    admin_name = COALESCE($1, admin_name)
  WHERE user_id = $2
  RETURNING *
`;
