import { Request, Response } from 'express';
import { query } from '../database/index.js';
import bcrypt from 'bcrypt';
import { 
  getUserByEmailAndRoleQuery,
  getStudentDetailsQuery,
  getFacultyDetailsQuery,
  getAdminDetailsQuery,
  createUserQuery,
} from '../database/queries/index.js';
import { generateToken } from '../utils/jwt.js';
import {LoginCredentials } from '../types/index.js';
import {hashPassword} from '../utils/hash.js';

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password,role } = req.body as LoginCredentials;

    // 1. Get user from database
    const userResult = await query(getUserByEmailAndRoleQuery, [email,role]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // 2. Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Get role-specific data
    let roleData = null;
    switch (user.role) {
      case 'student':
        roleData = await query(getStudentDetailsQuery, [user.user_id]);
        break;
      case 'faculty_advisor':
        roleData = await query(getFacultyDetailsQuery, [user.user_id]);
        break;
      case 'admin':
        roleData = await query(getAdminDetailsQuery, [user.user_id]);
        break;
      default:
        roleData = { rows: [] };
    }

    // 4. Generate JWT
    const token = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role
    });

    // 5. Send response
    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      profile: roleData.rows[0] || null
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

//sample register
export const registerController=async(req:Request,res:Response)=>{
  try {
    const { email, password,role } = req.body as LoginCredentials;

    // 1. Get user from database
    const userResult = await query(getUserByEmailAndRoleQuery, [email,role]);
    if (userResult.rows.length !== 0) {
      return res.status(400).send("user already exist")
                                      }
    const password_hash=await hashPassword(password);
    const registerresult=await query(createUserQuery, [email,password_hash,role]);
    console.log(registerresult);
    res.status(200).send("registration success");
}
catch(error){
  console.error('Register error:', error);
  res.status(500).json({ message: 'Registration failed' }); // Send 
}
};