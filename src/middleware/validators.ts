import { Request, Response, NextFunction } from 'express';
import { LoginCredentials,isUserRole, BulkRegisterStudentRow, BulkRegisterFacultyRow, BulkRegisterEventOrganizerRow, BulkRemoveRow,
  EditStudentInput, EditFacultyInput, EditEventOrganizerInput, EditAdminInput } from '../types/index.js';

export const validateLoginInput = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  next();
};




// --- Utility for department codes ---
const DEPARTMENT_CODES = ['CS', 'EC', 'ME', 'EE']; // Add more as needed

// --- Utility for program/roll number mapping ---
const PROGRAM_PREFIX: Record<string, string> = {
  btech: 'B',
  mtech: 'M',
  phd: 'P'
};

// Add PROGRAMS constant (single declaration)
const PROGRAMS = ['btech', 'mtech', 'phd'];

// helper: normalize string field from CSV / input (trim or return empty string)
const norm = (v: any) => (typeof v === 'string' ? v.trim() : v ?? '');

// helper: parse number from CSV - returns number or NaN
const pnum = (v: any) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isNaN(n) ? NaN : n;
  }
  return NaN;
};

export const validateRegisterInput = (req: Request, res: Response, next: NextFunction) => {
  const { email, role } = req.body;

  // Check email presence and type
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required and must be a string' });
  }

  // Check email domain
  if (!email.endsWith('@nitc.ac.in')) {
    return res.status(400).json({ message: 'Only NITC emails allowed' });
  }

  // REMOVED password validation entirely

  // Check role validity
  if (!role || !isUserRole(role)) {
    return res.status(400).json({ message: 'Invalid or missing user role' });
  }

  next();
};



// --- Student registration validator ---
export const validateStudentFields = (req: Request, res: Response, next: NextFunction) => {
  const { roll_number, student_name, department, program, batch_year, fa_name } = req.body;

  // Normalize inputs to avoid capitalization/order issues
  const dept = typeof department === 'string' ? department.trim().toUpperCase() : department;
  const prog = typeof program === 'string' ? program.trim().toLowerCase() : program;

  // Check required fields
  if (!roll_number || !student_name || !dept || !prog || !batch_year || !fa_name) {
    return res.status(400).json({ message: 'Missing required student fields' });
  }

  // Validate types
  if (typeof roll_number !== 'string' || typeof student_name !== 'string' ||
      typeof dept !== 'string' || typeof prog !== 'string' ||
      typeof batch_year !== 'number' || typeof fa_name !== 'string') {
    return res.status(400).json({ message: 'Invalid type for one or more student fields' });
  }

  // Validate program
  if (!PROGRAMS.includes(prog)) {
    return res.status(400).json({ message: 'Invalid program' });
  }

  // Validate department code
  if (!DEPARTMENT_CODES.includes(dept)) {
    return res.status(400).json({ message: 'Invalid department code' });
  }

  // Validate roll number format
  const expectedPrefix = PROGRAM_PREFIX[prog];
  const rollRegex = new RegExp(`^${expectedPrefix}\\d{6}${dept}$`, 'i');
  if (!rollRegex.test(roll_number)) {
    return res.status(400).json({ message: `Invalid roll number format for program ${prog} and department ${dept}` });
  }

  // Validate batch year
  if (batch_year < 2000 || batch_year > new Date().getFullYear() + 1) {
    return res.status(400).json({ message: 'Invalid batch year' });
  }

  next();
};

// --- Faculty Advisor registration validator ---
export const validateFacultyAdvisorFields = (req: Request, res: Response, next: NextFunction) => {
  const { fa_name, department } = req.body;
  if (!fa_name || typeof fa_name !== 'string') {
    return res.status(400).json({ message: 'fa_name is required and must be a string' });
  }
  if (!department || typeof department !== 'string' || !DEPARTMENT_CODES.includes(department)) {
    return res.status(400).json({ message: 'department is required and must be a valid department code' });
  }
  next();
};

// --- Event Organizer registration validator ---
export const validateEventOrganizerFields = (req: Request, res: Response, next: NextFunction) => {
  const { organizer_name, organization_name } = req.body;
  if (!organizer_name || typeof organizer_name !== 'string') {
    return res.status(400).json({ message: 'organizer_name is required and must be a string' });
  }
  if (!organization_name || typeof organization_name !== 'string') {
    return res.status(400).json({ message: 'organization_name is required and must be a string' });
  }
  next();
};

// --- Admin registration validator ---
export const validateAdminFields = (req: Request, res: Response, next: NextFunction) => {
  const { admin_name } = req.body;
  if (!admin_name || typeof admin_name !== 'string') {
    return res.status(400).json({ message: 'admin_name is required and must be a string' });
  }
  next();
};

// --- Event Organizer: Allocation Validator ---
export const validateAllocatePointsInput = (req: Request, res: Response, next: NextFunction) => {
  const { event_name, event_type, event_date } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'CSV file is required' });
  }
  if (!event_name || typeof event_name !== 'string') {
    return res.status(400).json({ message: 'event_name is required and must be a string' });
  }
  if (!event_type || !['institute_level', 'department_level', 'fa_assigned'].includes(event_type)) {
    return res.status(400).json({ message: 'event_type is required and must be one of: institute_level, department_level, fa_assigned' });
  }
  if (!event_date || isNaN(Date.parse(event_date))) {
    return res.status(400).json({ message: 'event_date is required and must be a valid date string (YYYY-MM-DD)' });
  }
  next();
};

// --- Event Organizer: Reallocate Points Validator ---
export const validateReallocatePointsInput = (req: Request, res: Response, next: NextFunction) => {
  const { allocation_id, event_name, event_type, event_date } = req.body;
  const file = req.file;

  if (!allocation_id || isNaN(Number(allocation_id))) {
    return res.status(400).json({ message: 'allocation_id is required and must be a number' });
  }
  if (!file && !event_name && !event_type && !event_date) {
    return res.status(400).json({ message: 'At least one of file, event_name, event_type, or event_date must be provided' });
  }
  if (event_name && typeof event_name !== 'string') {
    return res.status(400).json({ message: 'event_name must be a string' });
  }
  if (event_type && !['institute_level', 'department_level', 'fa_assigned'].includes(event_type)) {
    return res.status(400).json({ message: 'event_type must be one of: institute_level, department_level, fa_assigned' });
  }
  if (event_date && isNaN(Date.parse(event_date))) {
    return res.status(400).json({ message: 'event_date must be a valid date string (YYYY-MM-DD)' });
  }
  next();
};

// --- Event Organizer: Update Allocation Details Validator ---
export const validateUpdateAllocationDetailsInput = (req: Request, res: Response, next: NextFunction) => {
  const { allocation_id, event_name, event_type, event_date } = req.body;

  if (!allocation_id || isNaN(Number(allocation_id))) {
    return res.status(400).json({ message: 'allocation_id is required and must be a number' });
  }
  if (!event_name && !event_type && !event_date) {
    return res.status(400).json({ message: 'At least one of event_name, event_type, or event_date must be provided' });
  }
  if (event_name && typeof event_name !== 'string') {
    return res.status(400).json({ message: 'event_name must be a string' });
  }
  if (event_type && !['institute_level', 'department_level', 'fa_assigned'].includes(event_type)) {
    return res.status(400).json({ message: 'event_type must be one of: institute_level, department_level, fa_assigned' });
  }
  if (event_date && isNaN(Date.parse(event_date))) {
    return res.status(400).json({ message: 'event_date must be a valid date string (YYYY-MM-DD)' });
  }
  next();
};

// --- Event Organizer: Revoke Allocation Validator ---
export const validateRevokeAllocationInput = (req: Request, res: Response, next: NextFunction) => {
  const { allocation_id } = req.body;
  if (!allocation_id || isNaN(Number(allocation_id))) {
    return res.status(400).json({ message: 'allocation_id is required and must be a number' });
  }
  next();
};
// --- Download Allocation File Validator ---
export const validateDownloadAllocationFileInput = (req: Request, res: Response, next: NextFunction) => {
  const { allocation_id } = req.query;
  if (!allocation_id || isNaN(Number(allocation_id))) {
    return res.status(400).json({ message: 'allocation_id is required as a query parameter and must be a number' });
  }
  next();
};


export const validateSubmitStudentRequest = (req: Request, res: Response, next: NextFunction) => {
  const { event_name, event_type, event_date, points } = req.body;
  const file = req.file;

  if (!event_name || typeof event_name !== 'string')
    return res.status(400).json({ message: 'event_name is required and must be a string' });
  if (!event_type || !['institute_level', 'department_level', 'fa_assigned'].includes(event_type))
    return res.status(400).json({ message: 'event_type is required and must be a valid category' });
  if (!event_date || isNaN(Date.parse(event_date)))
    return res.status(400).json({ message: 'event_date is required and must be a valid date string' });
  if (!points || isNaN(Number(points)) || Number(points) <= 0)
    return res.status(400).json({ message: 'points must be a positive number' });
  if (!file)
    return res.status(400).json({ message: 'proof (PDF) is required' });
  if (file.mimetype !== 'application/pdf')
    return res.status(400).json({ message: 'proof must be a PDF file' });
  next();
};

export const validateResubmitStudentRequest = (req: Request, res: Response, next: NextFunction) => {
  const { point_id, event_name, event_type, event_date, points } = req.body;
  const file = req.file;

  if (!point_id || isNaN(Number(point_id)))
    return res.status(400).json({ message: 'point_id is required and must be a number' });

  if (!event_name && !event_type && !event_date && !points && !file)
    return res.status(400).json({ message: 'At least one field to update must be provided' });

  if (event_name && typeof event_name !== 'string')
    return res.status(400).json({ message: 'event_name must be a string' });
  if (event_type && !['institute_level', 'department_level', 'fa_assigned'].includes(event_type))
    return res.status(400).json({ message: 'event_type must be a valid category' });
  if (event_date && isNaN(Date.parse(event_date)))
    return res.status(400).json({ message: 'event_date must be a valid date string' });
  if (points && (isNaN(Number(points)) || Number(points) <= 0))
    return res.status(400).json({ message: 'points must be a positive number' });
  if (file && file.mimetype !== 'application/pdf')
    return res.status(400).json({ message: 'proof must be a PDF file' });
  next();
};

export const validateDownloadProofDocument = (req: Request, res: Response, next: NextFunction) => {
  const { point_id } = req.query;
  if (!point_id || isNaN(Number(point_id)))
    return res.status(400).json({ message: 'point_id is required as a query parameter and must be a number' });
  next();
};





export function validateBulkStudentRow(row: BulkRegisterStudentRow): string | null {
  const email = norm(row.email);
  const student_name = norm(row.student_name);
  const roll_number = norm(row.roll_number);
  const department = norm(row.department).toUpperCase();
  const program = norm(row.program).toLowerCase();
  const batch_year = pnum(row.batch_year);
  const fa_name = norm(row.fa_name);

  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  if (!student_name) return 'Missing student_name';
  if (!roll_number) return 'Missing roll_number';
  if (!department || !DEPARTMENT_CODES.includes(department)) return 'Invalid department';
  if (!program || !PROGRAMS.includes(program)) return 'Invalid program';
  if (Number.isNaN(batch_year) || batch_year < 2000 || batch_year > new Date().getFullYear() + 1) return 'Invalid batch_year';
  if (!fa_name) return 'Missing fa_name';
  return null;
}

export function validateBulkFacultyRow(row: BulkRegisterFacultyRow): string | null {
  const email = norm(row.email);
  const fa_name = norm(row.fa_name);
  const department = norm(row.department).toUpperCase();

  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  if (!fa_name) return 'Missing fa_name';
  if (!department || !DEPARTMENT_CODES.includes(department)) return 'Invalid department';
  return null;
}

export function validateBulkEventOrganizerRow(row: BulkRegisterEventOrganizerRow): string | null {
  const email = norm(row.email);
  const organizer_name = norm(row.organizer_name);
  const organization_name = norm(row.organization_name);

  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  if (!organizer_name) return 'Missing organizer_name';
  if (!organization_name) return 'Missing organization_name';
  return null;
}

export function validateBulkRemoveRow(row: BulkRemoveRow): string | null {
  const email = norm(row.email);
  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  return null;
}

export function validateEditStudentInput(input: EditStudentInput): string | null {
  if (input.department && !DEPARTMENT_CODES.includes(input.department)) return 'Invalid department';
  if (input.program && !PROGRAMS.includes(input.program)) return 'Invalid program';
  if (input.batch_year && typeof input.batch_year !== 'number') return 'Invalid batch_year';
  return null;
}

export function validateEditFacultyInput(input: EditFacultyInput): string | null {
  if (input.department && !DEPARTMENT_CODES.includes(input.department)) return 'Invalid department';
  return null;
}

export function validateEditEventOrganizerInput(input: EditEventOrganizerInput): string | null {
  return null;
}

export function validateEditAdminInput(input: EditAdminInput): string | null {
  return null;
}

