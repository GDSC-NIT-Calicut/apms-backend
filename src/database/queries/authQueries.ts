export const getUserByEmailAndRoleQuery = `
  SELECT user_id, email, role 
  FROM users 
  WHERE email = $1 AND role=$2
`;