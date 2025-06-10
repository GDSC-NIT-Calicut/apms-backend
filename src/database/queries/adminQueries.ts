export const getAdminDetailsQuery = `
  SELECT a.admin_id, a.admin_name
FROM admins a
WHERE a.user_id = $1

`;
