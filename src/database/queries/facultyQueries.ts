export const getFacultyDetailsQuery = `
  SELECT f.fa_id, f.fa_name, f.department
  FROM faculty_advisors f
  WHERE f.user_id = $1
`;
