export const getStudentDetailsQuery = `
  SELECT s.roll_number, s.student_name, s.department, s.program, 
         s.total_points, s.department_level_points, s.institute_level_points,
         s.fa_assigned_points, s.graduation_eligible
  FROM students s
  WHERE s.user_id = $1
`;
