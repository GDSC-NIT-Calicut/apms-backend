import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getClient, query } from '../database/index.js';
import {
  getStudentApprovedRequestsQuery,
  getStudentRejectedRequestsQuery,
  getStudentPendingRequestsQuery,
  getStudentProofDocumentQuery,
  insertStudentPointRequestQuery,
  getRejectedRequestByIdQuery,
  updateRejectedStudentPointRequestQuery,
  getStudentPointByIdQuery,
} from '../database/queries/studentQueries.js';
import { assertHasUser } from '../utils/assertions.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// --- View Requests ---
export const viewApprovedRequests = async (req: Request, res: Response) => {
  assertHasUser(req);
  const user_id = req.user.user_id;
  // Get roll_number for the user
  const studentResult = await query('SELECT roll_number FROM students WHERE user_id = $1', [user_id]);
  if (studentResult.rows.length === 0)
    return res.status(404).json({ message: 'Student not found' });

  const roll_number = studentResult.rows[0].roll_number;
  const result = await query(getStudentApprovedRequestsQuery, [roll_number]);
  res.json(result.rows);
};

export const viewRejectedRequests = async (req: Request, res: Response) => {
  assertHasUser(req);
  const user_id = req.user.user_id;
  const studentResult = await query('SELECT roll_number FROM students WHERE user_id = $1', [user_id]);
  if (studentResult.rows.length === 0)
    return res.status(404).json({ message: 'Student not found' });

  const roll_number = studentResult.rows[0].roll_number;
  const result = await query(getStudentRejectedRequestsQuery, [roll_number]);
  res.json(result.rows);
};

export const viewPendingRequests = async (req: Request, res: Response) => {
  assertHasUser(req);
  const user_id = req.user.user_id;
  const studentResult = await query('SELECT roll_number FROM students WHERE user_id = $1', [user_id]);
  if (studentResult.rows.length === 0)
    return res.status(404).json({ message: 'Student not found' });

  const roll_number = studentResult.rows[0].roll_number;
  const result = await query(getStudentPendingRequestsQuery, [roll_number]);
  res.json(result.rows);
};

// --- Download Proof Document ---
export const downloadProofDocument = async (req: Request, res: Response) => {
  assertHasUser(req);
  const user_id = req.user.user_id;
  const { point_id } = req.query;

  if (!point_id) return res.status(400).json({ message: 'Missing point_id' });

  // Ensure the request belongs to the student
  const studentResult = await query('SELECT roll_number FROM students WHERE user_id = $1', [user_id]);
  if (studentResult.rows.length === 0)
    return res.status(404).json({ message: 'Student not found' });

  const roll_number = studentResult.rows[0].roll_number;
  const pointResult = await query(getStudentProofDocumentQuery, [point_id, roll_number]);
  if (pointResult.rows.length === 0)
    return res.status(404).json({ message: 'Proof document not found' });

  const filePath = pointResult.rows[0].proof_document;
  if (!filePath)
    return res.status(404).json({ message: 'No file uploaded for this request' });

  const absoluteFilePath = path.resolve(filePath);
  try {
    await fs.access(absoluteFilePath);
  } catch {
    return res.status(404).json({ message: 'File not found on server' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(absoluteFilePath)}"`);
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(absoluteFilePath);
};

// --- Submit New Request ---
export const submitRequest = async (req: Request, res: Response) => {
  assertHasUser(req);
  const user_id = req.user.user_id;
  const { event_name, event_type, event_date, points } = req.body;
  const file = req.file;

  const studentResult = await query('SELECT roll_number FROM students WHERE user_id = $1', [user_id]);
  if (studentResult.rows.length === 0)
    return res.status(404).json({ message: 'Student not found' });

  const roll_number = studentResult.rows[0].roll_number;
  const proof_document = file ? path.resolve(file.path) : null;

  // Insert pending request
  try {
    const insertResult = await query(
      insertStudentPointRequestQuery,
      [roll_number, event_name, event_type, proof_document, points, 'PENDING', event_date]
    );
    res.status(201).json({ message: 'Request submitted', request: insertResult.rows[0] });
  } catch (error: any) {
    // Unique constraint violation (pending/approved already exists)
    if (error.code === '23505')
      return res.status(409).json({ message: 'A pending or approved request for this event already exists.' });
    throw error;
  }
};

// --- Resubmit Rejected Request ---
export const resubmitRequest = async (req: Request, res: Response) => {
  assertHasUser(req);
  const user_id = req.user.user_id;
  const { point_id, event_name, event_type, event_date, points } = req.body;
  const file = req.file;

  if (!point_id) return res.status(400).json({ message: 'Missing point_id' });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Ensure the request is rejected and belongs to this student
    const studentResult = await client.query('SELECT roll_number FROM students WHERE user_id = $1', [user_id]);
    if (studentResult.rows.length === 0)
      return res.status(404).json({ message: 'Student not found' });

    const roll_number = studentResult.rows[0].roll_number;
    const rejectedResult = await client.query(getRejectedRequestByIdQuery, [point_id, roll_number]);
    if (rejectedResult.rows.length === 0)
      return res.status(404).json({ message: 'Rejected request not found' });

    const oldRequest = rejectedResult.rows[0];

    // If file updated, delete old file
    let proof_document = oldRequest.proof_document;
    if (file) {
      if (proof_document) {
        try { await fs.unlink(proof_document); } catch {}
      }
      proof_document = path.resolve(file.path);
    }

    // Only update fields that are provided (use COALESCE in SQL)
    const updateResult = await client.query(
      updateRejectedStudentPointRequestQuery,
      [
        event_name || oldRequest.event_name,
        event_type || oldRequest.event_type,
        event_date || oldRequest.event_date,
        points || oldRequest.points,
        proof_document,
        point_id,
        roll_number
      ]
    );
    await client.query('COMMIT');
    res.json({ message: 'Request resubmitted', request: updateResult.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505')
      return res.status(409).json({ message: 'A pending or approved request for this event already exists.' });
    throw error;
  } finally {
    client.release();
  }
};
