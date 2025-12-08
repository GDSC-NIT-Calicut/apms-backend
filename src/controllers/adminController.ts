import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import path from 'path';
import { getClient } from '../database/index.js';
import {
  checkUserByEmailAndRoleQuery,
  createUserQuery,
  createStudentQuery,
  createFacultyAdvisorQuery,
  createEventOrganizerQuery,
  findFacultyAdvisorQuery,
  createStudentFacultyMappingQuery,
  removeUserByEmailQuery,
  getUserByEmailQuery,
  getFacultyAdvisorByUserIdQuery,
  getDummyFAForDepartmentQuery,
  editStudentByUserIdQuery,
  editFacultyByUserIdQuery,
  editEventOrganizerByUserIdQuery,
  editAdminByUserIdQuery
} from '../database/queries/index.js';
import {
  validateBulkStudentRow,
  validateBulkFacultyRow,
  validateBulkEventOrganizerRow,
  validateBulkRemoveRow
} from '../middleware/validators.js';
import { safeUnlink, isPathUnderBase } from '../utils/fileUtils.js';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const DUMMY_FA_EMAIL = '[email protected]';

// helper: normalize header text to expected key form
const normalizeKey = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

// build a row object with expected keys mapped from arbitrary csv headers
const mapRowToKeys = (rawRow: Record<string, any>, expectedKeys: string[]) => {
  const normMap: Record<string, any> = {};
  Object.keys(rawRow).forEach(k => {
    normMap[normalizeKey(k)] = rawRow[k];
  });
  const mapped: Record<string, any> = {};
  expectedKeys.forEach(k => {
    mapped[k] = normMap[k];
  });
  return mapped;
};

// parse CSV with headers and produce normalized rows (any column order)
const parseCsvFlexible = (fileBuffer: string) => {
  // parse with columns:true so we get header-based objects
  const rawRows = parse(fileBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, any>[];
  return rawRows;
};

// --- Bulk Register Students ---
// Controller now handles parsing + per-row validation using validators
export const bulkRegisterStudents = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file is required' });
  const filePath = path.resolve(req.file.path);

  if (!isPathUnderBase(filePath)) {
    await safeUnlink(filePath);
    return res.status(400).json({ message: 'Invalid upload location' });
  }

  const client = await getClient();
  try {
    const fileBuffer = await fs.readFile(filePath, 'utf8');
    const rawRows = parseCsvFlexible(fileBuffer);

    // map rows to expected keys (flexible column order)
    const expectedKeys = ['email', 'student_name', 'roll_number', 'department', 'program', 'batch_year', 'fa_name'];
    const records = rawRows.map(r => {
      const mapped = mapRowToKeys(r, expectedKeys);
      // cast batch_year if present
      if (mapped.batch_year !== undefined && mapped.batch_year !== null && mapped.batch_year !== '') {
        mapped.batch_year = Number(mapped.batch_year);
      }
      return mapped;
    });

    // validate rows using existing validator function
    for (let i = 0; i < records.length; i++) {
      const e = validateBulkStudentRow(records[i] as any);
      if (e) throw new Error(`Row ${i + 1}: ${e}`);
    }

    await client.query('BEGIN');
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const userCheck = await client.query(checkUserByEmailAndRoleQuery, [row.email, 'student']);
      if ((userCheck.rowCount ?? 0) > 0) throw new Error(`Row ${i + 1}: User already exists`);
      const userResult = await client.query(createUserQuery, [row.email, 'student']);
      const userId = userResult.rows[0].user_id;
      await client.query(createStudentQuery, [row.roll_number, row.student_name, userId, row.department, row.program, row.batch_year]);
      const faResult = await client.query(findFacultyAdvisorQuery, [row.fa_name, row.department]);
      if ((faResult.rowCount ?? 0) === 0) throw new Error(`Row ${i + 1}: Faculty advisor not found`);
      const faId = faResult.rows[0].fa_id;
      await client.query(createStudentFacultyMappingQuery, [row.roll_number, faId]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'All students registered successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ message: 'Bulk registration failed', error: err.message });
  } finally {
    client.release();
    await safeUnlink(filePath);
  }
};

// --- Bulk Register Faculty ---
export const bulkRegisterFaculty = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file is required' });
  const filePath = path.resolve(req.file.path);

  if (!isPathUnderBase(filePath)) {
    await safeUnlink(filePath);
    return res.status(400).json({ message: 'Invalid upload location' });
  }

  const client = await getClient();
  try {
    const fileBuffer = await fs.readFile(filePath, 'utf8');
    const rawRows = parseCsvFlexible(fileBuffer);

    const expectedKeys = ['email', 'fa_name', 'department'];
    const records = rawRows.map(r => mapRowToKeys(r, expectedKeys));

    for (let i = 0; i < records.length; i++) {
      const e = validateBulkFacultyRow(records[i] as any);
      if (e) throw new Error(`Row ${i + 1}: ${e}`);
    }

    await client.query('BEGIN');
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const userCheck = await client.query(checkUserByEmailAndRoleQuery, [row.email, 'faculty_advisor']);
      if ((userCheck.rowCount ?? 0) > 0) throw new Error(`Row ${i + 1}: User already exists`);
      const userResult = await client.query(createUserQuery, [row.email, 'faculty_advisor']);
      const userId = userResult.rows[0].user_id;
      await client.query(createFacultyAdvisorQuery, [row.fa_name, userId, row.department]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'All faculty registered successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ message: 'Bulk registration failed', error: err.message });
  } finally {
    client.release();
    await safeUnlink(filePath);
  }
};

// --- Bulk Register Event Organizers ---
export const bulkRegisterEventOrganizers = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file is required' });
  const filePath = path.resolve(req.file.path);

  if (!isPathUnderBase(filePath)) {
    await safeUnlink(filePath);
    return res.status(400).json({ message: 'Invalid upload location' });
  }

  const client = await getClient();
  try {
    const fileBuffer = await fs.readFile(filePath, 'utf8');
    const rawRows = parseCsvFlexible(fileBuffer);

    const expectedKeys = ['email', 'organizer_name', 'organization_name'];
    const records = rawRows.map(r => mapRowToKeys(r, expectedKeys));

    for (let i = 0; i < records.length; i++) {
      const e = validateBulkEventOrganizerRow(records[i] as any);
      if (e) throw new Error(`Row ${i + 1}: ${e}`);
    }

    await client.query('BEGIN');
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const userCheck = await client.query(checkUserByEmailAndRoleQuery, [row.email, 'event_organizer']);
      if ((userCheck.rowCount ?? 0) > 0) throw new Error(`Row ${i + 1}: User already exists`);
      const userResult = await client.query(createUserQuery, [row.email, 'event_organizer']);
      const userId = userResult.rows[0].user_id;
      await client.query(createEventOrganizerQuery, [row.organizer_name, userId, row.organization_name]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'All event organizers registered successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ message: 'Bulk registration failed', error: err.message });
  } finally {
    client.release();
    await safeUnlink(filePath);
  }
};

// --- Bulk Remove Users ---
export const bulkRemoveUsers = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file is required' });
  const filePath = path.resolve(req.file.path);

  if (!isPathUnderBase(filePath)) {
    await safeUnlink(filePath);
    return res.status(400).json({ message: 'Invalid upload location' });
  }

  const client = await getClient();
  try {
    const fileBuffer = await fs.readFile(filePath, 'utf8');
    const rawRows = parseCsvFlexible(fileBuffer);

    const expectedKeys = ['email'];
    const records = rawRows.map(r => mapRowToKeys(r, expectedKeys));

    for (let i = 0; i < records.length; i++) {
      const e = validateBulkRemoveRow(records[i] as any);
      if (e) throw new Error(`Row ${i + 1}: ${e}`);
    }

    await client.query('BEGIN');
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const email = row.email;
      if (email === SUPER_ADMIN_EMAIL || email === DUMMY_FA_EMAIL) throw new Error(`Row ${i + 1}: Cannot remove super admin or dummy FA`);
      const userRes = await client.query(getUserByEmailQuery, [email]);
      if ((userRes.rowCount ?? 0) === 0) throw new Error(`Row ${i + 1}: User not found`);
      const { user_id, role } = userRes.rows[0];
      if (role === 'faculty_advisor') {
        const faRes = await client.query(getFacultyAdvisorByUserIdQuery, [user_id]);
        if ((faRes.rowCount ?? 0) === 0) throw new Error(`Row ${i + 1}: Faculty advisor not found`);
        const { fa_id, department } = faRes.rows[0];
        const dummyFARes = await client.query(getDummyFAForDepartmentQuery, [department]);
        if ((dummyFARes.rowCount ?? 0) === 0) throw new Error(`Row ${i + 1}: Dummy FA not found for department`);
        const dummyFaId = dummyFARes.rows[0].fa_id;
        await client.query('UPDATE student_faculty_mapping SET fa_id = $1 WHERE fa_id = $2', [dummyFaId, fa_id]);
      }
      await client.query(removeUserByEmailQuery, [email]);
    }
    await client.query('COMMIT');
    res.status(200).json({ message: 'Bulk removal successful' });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ message: 'Bulk removal failed', error: err.message });
  } finally {
    client.release();
    await safeUnlink(filePath);
  }
};

// --- Edit Student (email in body) ---
export const editStudentDetails = async (req: Request, res: Response) => {
  const email = req.body.email;
  if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Invalid email parameter' });
  if (email === SUPER_ADMIN_EMAIL || email === DUMMY_FA_EMAIL) return res.status(403).json({ message: 'Editing super admin or dummy FA is not allowed' });
  const input = req.body;
  const client = await getClient();
  try {
    const userRes = await client.query(getUserByEmailQuery, [email]);
    if ((userRes.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Student not found' });
    const { user_id, role } = userRes.rows[0];
    if (role !== 'student') return res.status(400).json({ message: 'User is not a student' });
    const result = await client.query(
      editStudentByUserIdQuery,
      [input.student_name, input.department, input.roll_number, input.program, input.batch_year, user_id]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Student not found' });
    if (input.fa_name) {
      const department = input.department || result.rows[0].department;
      const faResult = await client.query(findFacultyAdvisorQuery, [input.fa_name, department]);
      let faId;
      if ((faResult.rowCount ?? 0) === 0) {
        const dummyFA = await client.query(getDummyFAForDepartmentQuery, [department]);
        faId = dummyFA.rows[0].fa_id;
      } else {
        faId = faResult.rows[0].fa_id;
      }
      await client.query(
        'UPDATE student_faculty_mapping SET fa_id = $1 WHERE student_roll_number = $2',
        [faId, result.rows[0].roll_number]
      );
    }
    res.status(200).json({ message: 'Student updated successfully', student: result.rows[0] });
  } finally {
    client.release();
  }
};

// --- Edit Faculty (email in body) ---
export const editFacultyDetails = async (req: Request, res: Response) => {
  const email = req.body.email;
  if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Invalid email parameter' });
  if (email === SUPER_ADMIN_EMAIL || email === DUMMY_FA_EMAIL) return res.status(403).json({ message: 'Editing super admin or dummy FA is not allowed' });
  const input = req.body;
  const client = await getClient();
  try {
    const userRes = await client.query(getUserByEmailQuery, [email]);
    if ((userRes.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Faculty advisor not found' });
    const { user_id, role } = userRes.rows[0];
    if (role !== 'faculty_advisor') return res.status(400).json({ message: 'User is not a faculty advisor' });
    const result = await client.query(
      editFacultyByUserIdQuery,
      [input.fa_name, input.department, user_id]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Faculty advisor not found' });
    res.status(200).json({ message: 'Faculty advisor updated', faculty: result.rows[0] });
  } finally {
    client.release();
  }
};

// --- Edit Event Organizer (email in body) ---
export const editEventOrganizerDetails = async (req: Request, res: Response) => {
  const email = req.body.email;
  if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Invalid email parameter' });
  if (email === SUPER_ADMIN_EMAIL || email === DUMMY_FA_EMAIL) return res.status(403).json({ message: 'Editing super admin or dummy FA is not allowed' });
  const input = req.body;
  const client = await getClient();
  try {
    const userRes = await client.query(getUserByEmailQuery, [email]);
    if ((userRes.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Event organizer not found' });
    const { user_id, role } = userRes.rows[0];
    if (role !== 'event_organizer') return res.status(400).json({ message: 'User is not an event organizer' });
    const result = await client.query(
      editEventOrganizerByUserIdQuery,
      [input.organizer_name, input.organization_name, user_id]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Event organizer not found' });
    res.status(200).json({ message: 'Event organizer updated', event_organizer: result.rows[0] });
  } finally {
    client.release();
  }
};

// --- Edit Admin (email in body) ---
export const editAdminDetails = async (req: Request, res: Response) => {
  const email = req.body.email;
  if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Invalid email parameter' });
  if (email === SUPER_ADMIN_EMAIL || email === DUMMY_FA_EMAIL) return res.status(403).json({ message: 'Editing super admin or dummy FA is not allowed' });
  const input = req.body;
  const client = await getClient();
  try {
    const userRes = await client.query(getUserByEmailQuery, [email]);
    if ((userRes.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Admin not found' });
    const { user_id, role } = userRes.rows[0];
    if (role !== 'admin') return res.status(400).json({ message: 'User is not an admin' });
    const result = await client.query(
      editAdminByUserIdQuery,
      [input.admin_name, user_id]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Admin not found' });
    res.status(200).json({ message: 'Admin updated', admin: result.rows[0] });
  } finally {
    client.release();
  }
};
