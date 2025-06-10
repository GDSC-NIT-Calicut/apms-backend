export const getUserByEmailAndRoleQuery = `
  SELECT user_id, email, password_hash, role 
  FROM users 
  WHERE email = $1 AND role=$2
`;

export const createUserQuery = `
  INSERT INTO users (email, password_hash, role)
  VALUES ($1, $2, $3)
  RETURNING user_id, email, role
`;
