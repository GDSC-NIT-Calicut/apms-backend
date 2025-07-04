import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { getClient, query } from '../database/index.js';
import {
  getFAPendingRequestsQuery,
  approveStudentPointRequestQuery,
  rejectStudentPointRequestQuery,
  getFADownloadProofDocumentQuery,
  getFAStudentStatusQuery,
  getStudentByRollNumberQuery,
  checkFADuplicateEventQuery,
  insertFAAssignedPointsQuery,
} from '../database/queries/index.js';
import { assertHasUser } from '../utils/assertions.js';

// --- View all pending requests for students assigned to FA ---
export const viewPendingRequests = async (req: Request, res: Response) => {
  assertHasUser(req);
  const fa_user_id = req.user.user_id;
  const result = await query(getFAPendingRequestsQuery, [fa_user_id]);
  res.json(result.rows);
};

// --- Approve a student point request ---
export const approveRequest = async (req: Request, res: Response) => {
  assertHasUser(req);
  const fa_user_id = req.user.user_id;
  const { point_id } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(approveStudentPointRequestQuery, [point_id, fa_user_id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request not found or not authorized' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Request approved', request: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve error:', err); // <--- Add this
    res.status(500).json({ message: 'Error approving request' });

  } finally {
    client.release();
  }
};

// --- Reject a student point request ---
export const rejectRequest = async (req: Request, res: Response) => {
  assertHasUser(req);
  const fa_user_id = req.user.user_id;
  const { point_id, rejection_reason } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(rejectStudentPointRequestQuery, [point_id, rejection_reason, fa_user_id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request not found or not authorized' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Request rejected', request: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error rejecting request' });
  } finally {
    client.release();
  }
};

// --- Download/view proof document ---
export const downloadProofDocument = async (req: Request, res: Response) => {
  assertHasUser(req);
  const { point_id } = req.query;
  const result = await query(getFADownloadProofDocumentQuery, [point_id]);
  if (result.rows.length === 0 || !result.rows[0].proof_document)
    return res.status(404).json({ message: 'Proof document not found' });
  const filePath = path.resolve(result.rows[0].proof_document);
  try {
    await fs.access(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ message: 'File not found on server' });
  }
};

// --- View status of all students assigned to FA ---
export const viewStudentStatus = async (req: Request, res: Response) => {
  assertHasUser(req);
  const fa_user_id = req.user.user_id;
  const result = await query(getFAStudentStatusQuery, [fa_user_id]);
  res.json(result.rows);
};

// --- Assign activity points to any student ---
export const assignActivityPoints = async (req: Request, res: Response) => {
  assertHasUser(req);
  const { roll_number, event_name, event_date, points } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Check student exists
    console.log('Assigning points to roll_number:', roll_number);
    const studentResult = await client.query(getStudentByRollNumberQuery, [roll_number]);
    if (studentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Student not found' });
    }
    // Check duplicate
    const duplicateResult = await client.query(checkFADuplicateEventQuery, [roll_number, event_name, event_date]);
    if (duplicateResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Event with same name and date already exists for this student' });
    }
    // Insert
    const insertResult = await client.query(insertFAAssignedPointsQuery, [roll_number, event_name, event_date, points]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Points assigned successfully', request: insertResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in assignActivityPoints:', err);
    res.status(500).json({ message: 'Error assigning points' });
  } finally {
    client.release();
  }
};
