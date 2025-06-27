// src/controllers/user.ts
import { Request, Response } from 'express';
import { query } from '../database/index.js';
import { 
  getStudentDetailsQuery,
  getFacultyDetailsQuery,
  getAdminDetailsQuery
} from '../database/queries/index.js';

export const getUserDetails = async (req: Request, res: Response) => {
  try {
    // User data from JWT (added by authenticate middleware)
    if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
    const { user_id, role } = req.user;

    let profile = null;
    switch (role) {
      case 'student':
        profile = (await query(getStudentDetailsQuery, [user_id])).rows[0];
        break;
      case 'faculty_advisor':
        profile = (await query(getFacultyDetailsQuery, [user_id])).rows[0];
        break;
      case 'admin':
        profile = (await query(getAdminDetailsQuery, [user_id])).rows[0];
        break;
    }

    res.json({
      user: {
        user_id,
        role,
        email: req.user.email // From JWT
      },
      profile
    });
  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
