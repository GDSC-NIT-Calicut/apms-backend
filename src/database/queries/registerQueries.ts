// User creation
export const createUserQuery = `
  INSERT INTO users (email, password_hash, role)
  VALUES ($1, $2, $3)
  RETURNING user_id, email, role
`;

// Student creation
export const createStudentQuery = `
  INSERT INTO students (roll_number, student_name, user_id, department, program, batch_year)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING roll_number
`;

// Faculty advisor lookup (by name and department)
export const findFacultyAdvisorQuery = `
  SELECT fa_id FROM faculty_advisors WHERE fa_name = $1 AND department = $2
`;

// Student-faculty mapping
export const createStudentFacultyMappingQuery = `
  INSERT INTO student_faculty_mapping (student_roll_number, fa_id)
  VALUES ($1, $2)
`;

// Faculty advisor creation
export const createFacultyAdvisorQuery = `
  INSERT INTO faculty_advisors (fa_name, user_id, department)
  VALUES ($1, $2, $3)
  RETURNING fa_id
`;

// Event organizer creation
export const createEventOrganizerQuery = `
  INSERT INTO event_organizers (organizer_name, user_id, organization_name)
  VALUES ($1, $2, $3)
  RETURNING organizer_id
`;

// Admin creation
export const createAdminQuery = `
  INSERT INTO admins (admin_name, user_id)
  VALUES ($1, $2)
  RETURNING admin_id
`;

export const checkUserByEmailAndRoleQuery = `
  SELECT 1 FROM users WHERE email = $1 AND role = $2
`;
