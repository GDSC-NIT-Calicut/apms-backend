import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import path from 'path';
import { getClient, query } from '../database/index.js';
import {
  getOrganizerIdByUserIdQuery,
  insertAllocationQuery,
  bulkInsertStudentPointsQuery,
  getAllocatedAllocationsByOrganizerQuery,
  getRevokedAllocationsByOrganizerQuery,
  getAllocationByIdQuery,
  deleteStudentPointsByEventAndRollNumbersQuery,
  revokeAllocationQuery,
  updateAllocationDetailsQuery,
  updateStudentPointsQuery,
  updateevnetdetails
} from '../database/queries/eventOrganizerQueries.js';
import { AllocationCSVRow, EventOrganizerAllocation } from '../types/index.js';
import { assertHasUser } from '../utils/assertions.js';
import { isPathUnderBase, safeUnlink } from '../utils/fileUtils.js';

// Helper to parse CSV file
const parseCSV = (fileBuffer: Buffer): AllocationCSVRow[] => {
  const records = parse(fileBuffer, {
    columns: ['roll_number', 'points'],
    skip_empty_lines: true,
    from_line: 2, // Skip header row
    cast: (value, context) => {
      if (context.column === 'points') {
        const points = parseInt(value, 10);
        if (isNaN(points)) {
          throw new Error(`Invalid points value at line ${context.lines}: ${value}`);
        }
        return points;
      }
      return value;
    }
  });
  return records;
};


export const allocatePoints = async (req: Request, res: Response) => {
  assertHasUser(req);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { event_name, event_type, event_date } = req.body;
    const file = req.file;

    if (!file) throw new Error('No file uploaded');
    if (!event_name || !event_type || !event_date) {
      throw new Error('Missing event details');
    }

    const user_id = req.user.user_id;
    const organizerResult = await client.query(
      getOrganizerIdByUserIdQuery,
      [user_id]
    );

    if (organizerResult.rows.length === 0) {
      throw new Error('Organizer not found');
    }

    const organizer_id = organizerResult.rows[0].organizer_id;

    // Read the file from disk and parse CSV
    const fileBuffer = await fs.readFile(file.path);
    const records: AllocationCSVRow[] = parseCSV(fileBuffer);

    // Process student points
    for (const record of records) {
      await client.query(
        bulkInsertStudentPointsQuery,
        [
          record.roll_number,
          event_name,
          event_type,
          record.points,
          new Date(event_date)
        ]
      );
    }

    // Get absolute path for consistent storage and ensure it's inside uploads dir
    const absoluteFilePath = path.resolve(file.path);
    if (!isPathUnderBase(absoluteFilePath)) {
      throw new Error('Invalid file path (outside uploads dir)');
    }

    // Insert allocation record with ABSOLUTE path
    const allocationResult = await client.query(
      insertAllocationQuery,
      [
        organizer_id,
        absoluteFilePath,  // Store absolute path
        'allocated',
        event_name,
        event_type,
        new Date(event_date)
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      allocation: allocationResult.rows[0],
      students_allocated: records.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Allocation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};


export const getAllocatedAllocations = async (req: Request, res: Response) => {
  assertHasUser(req);
  try {
    const user_id = req.user.user_id;
    const organizerResult = await query(
      getOrganizerIdByUserIdQuery, 
      [user_id]
    );
    
    if (organizerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }
    
    const organizer_id = organizerResult.rows[0].organizer_id;
    
    const allocations = await query(
      getAllocatedAllocationsByOrganizerQuery, 
      [organizer_id]
    );
    
    res.json(allocations.rows);
  } catch (error) {
    console.error('Get allocated allocations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRevokedAllocations = async (req: Request, res: Response) => {
  assertHasUser(req);
  try {
    const user_id = req.user.user_id;
    const organizerResult = await query(
      getOrganizerIdByUserIdQuery, 
      [user_id]
    );
    
    if (organizerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }
    
    const organizer_id = organizerResult.rows[0].organizer_id;
    
    const allocations = await query(
      getRevokedAllocationsByOrganizerQuery, 
      [organizer_id]
    );
    
    res.json(allocations.rows);
  } catch (error) {
    console.error('Get revoked allocations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// --- Download Allocation File (use DB to fetch file_path and validate ACL) ---
export const downloadAllocationFile = async (req: Request, res: Response) => {
  assertHasUser(req);
  try {
    const { allocationId } = req.params;
    if (!allocationId) {
      return res.status(400).json({ message: 'Missing allocationId parameter' });
    }

    // Ensure the caller is the organizer (or adjust logic for admins)
    const user_id = req.user.user_id;
    const organizerResult = await query(getOrganizerIdByUserIdQuery, [user_id]);
    if (organizerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }
    const organizer_id = organizerResult.rows[0].organizer_id;

    const allocationResult = await query(getAllocationByIdQuery, [allocationId, organizer_id]);
    if (allocationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    const allocation = allocationResult.rows[0] as EventOrganizerAllocation;
    const absoluteFilePath = path.resolve(allocation.file_path);

    if (!isPathUnderBase(absoluteFilePath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.sendFile(absoluteFilePath);
  } catch (err: any) {
    console.error('Download error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// --- Revoke Allocation (validate file path before reading) ---
export const revokeAllocation = async (req: Request, res: Response) => {
  assertHasUser(req);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { allocation_id } = req.body;

    if (!allocation_id) {
      return res.status(400).json({ message: 'Missing allocation_id' });
    }

    const user_id = req.user.user_id;
    const organizerResult = await client.query(
      getOrganizerIdByUserIdQuery,
      [user_id]
    );

    if (organizerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const organizer_id = organizerResult.rows[0].organizer_id;

    // Get allocation
    const allocationResult = await client.query(
      getAllocationByIdQuery,
      [allocation_id, organizer_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    const allocation: EventOrganizerAllocation = allocationResult.rows[0];

    if (allocation.status === 'revoked') {
      return res.status(400).json({ message: 'Allocation already revoked' });
    }

    // Validate file path before reading
    const absoluteFilePath = path.resolve(allocation.file_path);
    if (!isPathUnderBase(absoluteFilePath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Parse CSV to get roll numbers
    const fileBuffer = await fs.readFile(absoluteFilePath);
    const records: AllocationCSVRow[] = parseCSV(fileBuffer);
    const rollNumbers = records.map(r => r.roll_number);

    // Delete student points
    await client.query(
      deleteStudentPointsByEventAndRollNumbersQuery,
      [
        allocation.event_name,
        allocation.event_date,
        rollNumbers
      ]
    );

    // Update allocation status
    await client.query(
      revokeAllocationQuery,
      [allocation_id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Allocation revoked',
      students_affected: rollNumbers.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Revocation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};

// --- Reallocate Points (safe unlink old file if replacing with new file) ---
export const reallocatePoints = async (req: Request, res: Response) => {
  assertHasUser(req);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { allocation_id, event_name, event_type, event_date } = req.body;
    const file = req.file;

    if (!allocation_id) {
      return res.status(400).json({ message: 'Missing allocation_id' });
    }

    if (!file && !event_name && !event_type && !event_date) {
      return res.status(400).json({ message: 'No changes provided' });
    }

    const user_id = req.user.user_id;
    const organizerResult = await client.query(
      getOrganizerIdByUserIdQuery,
      [user_id]
    );

    if (organizerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const organizer_id = organizerResult.rows[0].organizer_id;

    // Get existing allocation
    const allocationResult = await client.query(
      getAllocationByIdQuery,
      [allocation_id, organizer_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    const allocation: EventOrganizerAllocation = allocationResult.rows[0];

    // Handle new file if uploaded
    let newFilePath = allocation.file_path;
    let records: AllocationCSVRow[] = [];

    if (file) {
      // Parse new CSV
      const newFileBuffer = await fs.readFile(file.path);
      records = parseCSV(newFileBuffer);
      newFilePath = file.path;
    } else {
      // Use existing file (ensure safe path)
      const absPath = path.resolve(allocation.file_path);
      if (!isPathUnderBase(absPath)) {
        throw new Error('Invalid file path (outside uploads dir)');
      }
      const oldFileBuffer = await fs.readFile(absPath);
      records = parseCSV(oldFileBuffer);
    }

    // Determine actual event details to use
    const finalEventName = event_name || allocation.event_name;
    const finalEventType = event_type || allocation.event_type;
    const finalEventDate = event_date ? new Date(event_date) : allocation.event_date;

    // Revoke old points only if allocation was previously allocated
    if (allocation.status === 'allocated') {
      const absOldPath = path.resolve(allocation.file_path);
      if (!isPathUnderBase(absOldPath)) {
        throw new Error('Invalid file path (outside uploads dir)');
      }
      const oldFileBuffer = await fs.readFile(absOldPath);
      const oldRecords: AllocationCSVRow[] = parseCSV(oldFileBuffer);
      const oldRollNumbers = oldRecords.map(r => r.roll_number);

      await client.query(
        deleteStudentPointsByEventAndRollNumbersQuery,
        [
          allocation.event_name,
          allocation.event_date,
          oldRollNumbers
        ]
      );
    }

    // Insert new student points
    for (const record of records) {
      await client.query(
        bulkInsertStudentPointsQuery,
        [
          record.roll_number,
          finalEventName,
          finalEventType,
          record.points,
          finalEventDate
        ]
      );
    }
    
    // Update allocation record with new details
    const updatedAllocation = await client.query(
      updateAllocationDetailsQuery,
      [
        newFilePath,
        finalEventName,
        finalEventType,
        finalEventDate,
        allocation_id
      ]
    );

    // Delete old file if new file was uploaded (use safeUnlink)
    if (file) {
      const absOldPath = path.resolve(allocation.file_path);
      if (isPathUnderBase(absOldPath)) {
        await safeUnlink(absOldPath);
      }
    }

    await client.query('COMMIT');

    res.json({
      allocation: updatedAllocation.rows[0],
      students_allocated: records.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reallocation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};

// --- Update Allocation Details (validate file path before reading) ---
export const updateAllocationDetails = async (req: Request, res: Response) => {
  assertHasUser(req);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { allocation_id, event_name, event_type, event_date } = req.body;

    if (!allocation_id) {
      return res.status(400).json({ message: 'Missing allocation_id' });
    }

    if (!event_name && !event_type && !event_date) {
      return res.status(400).json({ message: 'No changes provided' });
    }

    const user_id = req.user.user_id;
    const organizerResult = await client.query(
      getOrganizerIdByUserIdQuery,
      [user_id]
    );

    if (organizerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const organizer_id = organizerResult.rows[0].organizer_id;

    // Get current allocation
    const allocationResult = await client.query(
      getAllocationByIdQuery,
      [allocation_id, organizer_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    const allocation = allocationResult.rows[0];

    // Check if allocation is revoked
    if (allocation.status === 'revoked') {
      return res.status(400).json({
        message: 'Cannot update details of revoked allocations. Use reallocate instead.'
      });
    }

    // Format date properly for SQL
    const formattedEventDate = event_date ? new Date(event_date).toISOString().split('T')[0] : null;

    // Update allocation details
    const updatedAllocation = await client.query(
      updateevnetdetails,
      [
        event_name || allocation.event_name,
        event_type || allocation.event_type,
        formattedEventDate || allocation.event_date,  // Use formatted date
        allocation_id
      ]
    );

    if (updatedAllocation.rows.length === 0) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    // Ensure file path is valid before reading
    const absPath = path.resolve(allocation.file_path);
    if (!isPathUnderBase(absPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Read the CSV file to get roll numbers
    const fileBuffer = await fs.readFile(absPath);
    const records: AllocationCSVRow[] = parseCSV(fileBuffer);
    const rollNumbers = records.map(r => r.roll_number);

    // Update student points for each roll number
    for (const rollNumber of rollNumbers) {
      await client.query(
        updateStudentPointsQuery,
        [
          event_name,
          event_type,
          formattedEventDate,  // Use formatted date
          rollNumber,
          allocation.event_name,
          allocation.event_date
        ]
      );
    }

    await client.query('COMMIT');

    res.json({
      allocation: updatedAllocation.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};


