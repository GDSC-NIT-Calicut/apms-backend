import { Request, Response } from 'express';
import { query } from '../database/index.js';
import bcrypt from 'bcrypt';
import ms from 'ms';
import { 
  getUserByEmailAndRoleQuery,
  getStudentDetailsQuery,
  getFacultyDetailsQuery,
  getAdminDetailsQuery,
  getEventOrganizerDetailsQuery,
} from '../database/queries/index.js';
import { generateToken } from '../utils/jwt.js';
import { LoginCredentials } from '../types/index.js';
import { config } from '../config/environment.js';

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body as LoginCredentials;

    // Hard-coded admin check
    if (role === 'admin' && 
        email === config.hardCodedAdmin.email &&
        password === config.hardCodedAdmin.password) {
      
      const adminProfile = {
        admin_id: -1,
        admin_name: config.hardCodedAdmin.name
      };

      const token = generateToken({
        user_id: -1,
        email: config.hardCodedAdmin.email,
        role: 'admin'
      });

      const expiresInMs = ms(config.jwt.expiresIn as ms.StringValue);
      
      // Set cookie and return response
      return res
        .cookie('token', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: expiresInMs,
          path: '/',
        })
        .json({
          user: {
            user_id: -1,
            email: config.hardCodedAdmin.email,
            role: 'admin'
          },
          profile: adminProfile
        });
    }

    // Normal user flow
    const userResult = await query(getUserByEmailAndRoleQuery, [email, role]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

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
      case 'event_organizer':
        roleData = await query(getEventOrganizerDetailsQuery, [user.user_id]);
        break;
      default:
        roleData = { rows: [] };
    }

    const token = generateToken({
      user_id: user.user_id,
      email: user.email,  
      role: user.role
    });

    const expiresInMs = ms(config.jwt.expiresIn as ms.StringValue);

    // Return response with cookie
    return res
      .cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: expiresInMs,
        path: '/',
      })
      .json({
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role
        },
        profile: roleData.rows[0] || null
      });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
