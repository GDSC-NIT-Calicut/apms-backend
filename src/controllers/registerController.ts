import { Request, Response } from 'express';
import { pool } from '../database/index.js';
import {
  checkUserByEmailAndRoleQuery,
  createUserQuery,
  createStudentQuery,
  findFacultyAdvisorQuery,
  createStudentFacultyMappingQuery,
  createAdminQuery,
  createEventOrganizerQuery,
  createFacultyAdvisorQuery
} from '../database/queries/index.js';

// --- Student Registration ---
export const registerStudentController = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      email, role,
      roll_number, student_name, department, program, batch_year, fa_name
    } = req.body;

    // Check if user exists with same email and role
    const userCheck = await client.query(checkUserByEmailAndRoleQuery, [email, role]);
    if ((userCheck.rowCount ?? 0) > 0) {
      return res.status(409).json({ message: 'User with this email and role already exists' });
    }

    await client.query('BEGIN');

    // Create user WITHOUT password
    const userResult = await client.query(createUserQuery, [email, role]);
    const userId = userResult.rows[0].user_id;

    // Create student
    await client.query(
      createStudentQuery,
      [roll_number, student_name, userId, department, program, batch_year]
    );

    // Find faculty advisor
    const faResult = await client.query(findFacultyAdvisorQuery, [fa_name, department]);
    if (faResult.rowCount === 0) {
      throw new Error('Faculty advisor not found');
    }
    const faId = faResult.rows[0].fa_id;

    // Create student-faculty mapping
    await client.query(createStudentFacultyMappingQuery, [roll_number, faId]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Student registered successfully', user: userResult.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Registration failed', error: err.message });
  } finally {
    client.release();
  }
};

// --- Admin Registration ---
export const registerAdminController = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { email, role, admin_name } = req.body;

    // Check if user exists with same email and role
    const userCheck = await client.query(checkUserByEmailAndRoleQuery, [email, role]);
    if ((userCheck.rowCount ?? 0) > 0) {
      return res.status(409).json({ message: 'User with this email and role already exists' });
    }

    await client.query('BEGIN');

    // Create user WITHOUT password
    const userResult = await client.query(createUserQuery, [email, role]);
    const userId = userResult.rows[0].user_id;

    // Create admin
    await client.query(createAdminQuery, [admin_name, userId]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Admin registered successfully', user: userResult.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Registration failed', error: err.message });
  } finally {
    client.release();
  }
};

// --- Event Organizer Registration ---
export const registerEventOrganizerController = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { email, role, organizer_name, organization_name } = req.body;

    // Check if user exists with same email and role
    const userCheck = await client.query(checkUserByEmailAndRoleQuery, [email, role]);
    if ((userCheck.rowCount ?? 0) > 0) {
      return res.status(409).json({ message: 'User with this email and role already exists' });
    }

    await client.query('BEGIN');

    // Create user WITHOUT password
    const userResult = await client.query(createUserQuery, [email, role]);
    const userId = userResult.rows[0].user_id;

    // Create event organizer
    await client.query(createEventOrganizerQuery, [organizer_name, userId, organization_name]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Event organizer registered successfully', user: userResult.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Registration failed', error: err.message });
  } finally {
    client.release();
  }
};

// --- Faculty Advisor Registration ---
export const registerFacultyAdvisorController = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { email, role, fa_name, department } = req.body;

    // Check if user exists with same email and role
    const userCheck = await client.query(checkUserByEmailAndRoleQuery, [email, role]);
    if ((userCheck.rowCount ?? 0) > 0) {
      return res.status(409).json({ message: 'User with this email and role already exists' });
    }

    await client.query('BEGIN');

    // Create user WITHOUT password
    const userResult = await client.query(createUserQuery, [email, role]);
    const userId = userResult.rows[0].user_id;

    // Create faculty advisor
    await client.query(createFacultyAdvisorQuery, [fa_name, userId, department]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Faculty advisor registered successfully', user: userResult.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Registration failed', error: err.message });
  } finally {
    client.release();
  }
};
