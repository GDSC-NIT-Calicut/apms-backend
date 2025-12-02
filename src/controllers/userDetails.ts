// src/controllers/user.ts
import { Request, Response } from 'express';
import { query } from '../database/index.js';
import { 
  getStudentDetailsQuery,
  getFacultyDetailsQuery,
  getEventOrganizerDetailsQuery,
  getAdminDetailsQuery
} from '../database/queries/index.js';
import { config } from '../config/environment.js';

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
      case 'event_organizer':
        profile = (await query(getEventOrganizerDetailsQuery, [user_id])).rows[0];
        break;
      case 'admin':
        // handle hardcoded admin (user_id === -1) and DB admin
        if (Number(user_id) === -1) {
          profile = {
            admin_id: -1,
            admin_name: config.hardCodedAdmin.name,
            email: config.hardCodedAdmin.email
          };
        } else {
          profile = (await query(getAdminDetailsQuery, [user_id])).rows[0];
        }
        break;
      default:
        profile = null;
    }

    return res.status(200).json({
      user: {
        role
      },
      profile
    });
  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
