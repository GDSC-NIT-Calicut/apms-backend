export const getUserByEmailAndRoleQuery = `
  SELECT user_id, email, password_hash, role 
  FROM users 
  WHERE email = $1 AND role=$2
`;


