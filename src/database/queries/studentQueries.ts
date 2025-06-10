export const getStudentDetailsQuery = `
  SELECT s.roll_number, s.student_name, s.department, s.program, 
         s.total_ap, s.department_ap, s.institute_ap,
         s.fa_assigned, s.is_eligible
  FROM students s
  WHERE s.user_id = $1
`;
