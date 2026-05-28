import { Request, Response, NextFunction } from 'express';
import { isUserRole, BulkRegisterStudentRow, BulkRegisterFacultyRow, BulkRegisterEventOrganizerRow, BulkRemoveRow,
  EditStudentInput, EditFacultyInput, EditEventOrganizerInput, EditAdminInput } from '../types/index.js';

// --- Helper function to convert all string fields in req.body to lowercase ---
const convertReqBodyToLowercase = (req: Request) => {
  const convertValue = (value: any): any => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    if (Array.isArray(value)) {
      return value.map(convertValue);
    }
    if (value !== null && typeof value === 'object') {
      return Object.keys(value).reduce((acc, key) => {
        acc[key] = convertValue(value[key]);
        return acc;
      }, {} as any);
    }
    return value;
  };
  
  req.body = convertValue(req.body);
};

export const validateLoginInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  next();
};




// --- Utility for department codes ---
const DEPARTMENT_CODES = ['cs', 'ec', 'me', 'ee']; // Add more as needed

// --- Utility for program/roll number mapping ---
const PROGRAM_PREFIX: Record<string, string> = {
  btech: 'b',
  mtech: 'm',
  phd: 'p'
};

// --- Reverse mapping from program prefix to program name ---
const PROGRAM_FROM_PREFIX: Record<string, string> = {
  b: 'btech',
  m: 'mtech',
  p: 'phd'
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

// --- Helper function to extract department and program from roll number ---
// Roll number format: [program_char][6_digits][department_code]
// Example: b230395cs -> program='btech', department='cs'
interface ExtractedRollData {
  program: string | null;
  department: string | null;
  error?: string;
}

const extractDeptAndProgramFromRoll = (roll_number: string): ExtractedRollData => {
  const normalized = roll_number.toLowerCase().trim();
  
  // Validate length - should be at least 9 chars (1 + 6 + 2)
  if (normalized.length < 9) {
    return { program: null, department: null, error: 'Roll number too short' };
  }
  
  // Extract parts
  const programChar = normalized[0];
  const department = normalized.slice(-2); // last 2 characters
  
  // Validate program character
  if (!PROGRAM_FROM_PREFIX[programChar]) {
    return { program: null, department: null, error: `Invalid program prefix: ${programChar}` };
  }
  
  // Validate department code
  if (!DEPARTMENT_CODES.includes(department)) {
    return { program: null, department: null, error: `Invalid department code: ${department}` };
  }
  
  return {
    program: PROGRAM_FROM_PREFIX[programChar],
    department: department
  };
};

export const validateRegisterInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  const { email} = req.body;

  // Check email presence and type
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required and must be a string' });
  }

  // Check email domain
  if (!email.endsWith('@nitc.ac.in')) {
    return res.status(400).json({ message: 'Only NITC emails allowed' });
  }

  next();
};



// --- Student registration validator ---
export const validateStudentFields = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  const { roll_number, student_name, batch_year, fa_name } = req.body;

  // Check required fields (department and program are extracted from roll_number)
  if (!roll_number || !student_name || !batch_year || !fa_name) {
    return res.status(400).json({ message: 'Missing required student fields: roll_number, student_name, batch_year, fa_name' });
  }

  // Validate types
  if (typeof roll_number !== 'string' || typeof student_name !== 'string' ||
      typeof batch_year !== 'number' || typeof fa_name !== 'string') {
    return res.status(400).json({ message: 'Invalid type for one or more student fields' });
  }

  // Validate and extract department and program from roll number
  const { program, department, error } = extractDeptAndProgramFromRoll(roll_number);
  if (error) {
    return res.status(400).json({ message: `Invalid roll number: ${error}` });
  }

  // Validate roll number format (should be [program_char][6_digits][2_dept_chars])
  const rollRegex = /^[a-z]\d{6}[a-z]{2}$/i;
  if (!rollRegex.test(roll_number)) {
    return res.status(400).json({ message: 'Roll number format should be: [program_char][6_digits][department_code]' });
  }

  // Validate batch year
  if (batch_year < 2000 || batch_year > new Date().getFullYear() + 1) {
    return res.status(400).json({ message: 'Invalid batch year' });
  }

  // Store extracted values in req.body for the controller to use
  req.body.department = department;
  req.body.program = program;

  next();
};

// --- Faculty Advisor registration validator ---
export const validateFacultyAdvisorFields = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
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
  convertReqBodyToLowercase(req);
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
  convertReqBodyToLowercase(req);
  const { admin_name } = req.body;
  if (!admin_name || typeof admin_name !== 'string') {
    return res.status(400).json({ message: 'admin_name is required and must be a string' });
  }
  next();
};

// --- Event Organizer: Allocation Validator ---
export const validateAllocatePointsInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
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
  convertReqBodyToLowercase(req);
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
  convertReqBodyToLowercase(req);
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
  convertReqBodyToLowercase(req);
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
  convertReqBodyToLowercase(req);
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
  const email = norm(row.email).toLowerCase();
  const student_name = norm(row.student_name).toLowerCase();
  const roll_number = norm(row.roll_number).toLowerCase();
  const batch_year = pnum(row.batch_year);
  const fa_name = norm(row.fa_name).toLowerCase();

  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  if (!student_name) return 'Missing student_name';
  if (!roll_number) return 'Missing roll_number';
  if (!fa_name) return 'Missing fa_name';

  // Extract department and program from roll number
  const { program, department, error } = extractDeptAndProgramFromRoll(roll_number);
  if (error) return `Invalid roll_number: ${error}`;

  // Validate roll number format
  const rollRegex = /^[a-z]\d{6}[a-z]{2}$/i;
  if (!rollRegex.test(roll_number)) return 'Roll number format invalid';

  if (Number.isNaN(batch_year) || batch_year < 2000 || batch_year > new Date().getFullYear() + 1) return 'Invalid batch_year';
  
  // Modify row in place to store lowercase values and extracted department/program
  row.email = email;
  row.student_name = student_name;
  row.roll_number = roll_number;
  row.fa_name = fa_name;
  row.department = department!;
  row.program = program as 'btech' | 'mtech' | 'phd';
  
  return null;
}

export function validateBulkFacultyRow(row: BulkRegisterFacultyRow): string | null {
  const email = norm(row.email).toLowerCase();
  const fa_name = norm(row.fa_name).toLowerCase();
  const department = norm(row.department).toLowerCase();

  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  if (!fa_name) return 'Missing fa_name';
  if (!department || !DEPARTMENT_CODES.includes(department)) return 'Invalid department';
  
  // Modify row in place to store lowercase values
  row.email = email;
  row.fa_name = fa_name;
  row.department = department;
  
  return null;
}

export function validateBulkEventOrganizerRow(row: BulkRegisterEventOrganizerRow): string | null {
  const email = norm(row.email).toLowerCase();
  const organizer_name = norm(row.organizer_name).toLowerCase();
  const organization_name = norm(row.organization_name).toLowerCase();

  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  if (!organizer_name) return 'Missing organizer_name';
  if (!organization_name) return 'Missing organization_name';
  
  // Modify row in place to store lowercase values
  row.email = email;
  row.organizer_name = organizer_name;
  row.organization_name = organization_name;
  
  return null;
}

export function validateBulkRemoveRow(row: BulkRemoveRow): string | null {
  const email = norm(row.email).toLowerCase();
  if (!email || !email.endsWith('@nitc.ac.in')) return 'Invalid email';
  
  // Modify row in place to store lowercase values
  row.email = email;
  
  return null;
}

// --- Edit validators: middleware that respond with errors ---
export const validateEditStudentInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  const input = req.body;
  
  // If roll_number is provided, extract and validate department and program from it
  if (input.roll_number) {
    if (typeof input.roll_number !== 'string') {
      return res.status(400).json({ message: 'roll_number must be a string' });
    }
    
    // Validate roll number format (should be [program_char][6_digits][2_dept_chars])
    const rollRegex = /^[a-z]\d{6}[a-z]{2}$/i;
    if (!rollRegex.test(input.roll_number)) {
      return res.status(400).json({ message: 'Roll number format should be: [program_char][6_digits][department_code]' });
    }

    // Extract department and program from roll number
    const { program, department, error } = extractDeptAndProgramFromRoll(input.roll_number);
    if (error) {
      return res.status(400).json({ message: `Invalid roll number: ${error}` });
    }
    
    // Set extracted values - these will override any provided department/program
    input.department = department;
    input.program = program;
  }
  
  if (input.department && !DEPARTMENT_CODES.includes(input.department)) {
    return res.status(400).json({ message: 'Invalid department' });
  }
  if (input.program && !PROGRAMS.includes(input.program)) {
    return res.status(400).json({ message: 'Invalid program' });
  }
  if (input.batch_year && typeof input.batch_year !== 'number') {
    return res.status(400).json({ message: 'Invalid batch_year' });
  }
  next();
};

export const validateEditFacultyInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  const input = req.body;
  
  if (input.department && !DEPARTMENT_CODES.includes(input.department)) {
    return res.status(400).json({ message: 'Invalid department' });
  }
  next();
};

export const validateEditEventOrganizerInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  next();
};

export const validateEditAdminInput = (req: Request, res: Response, next: NextFunction) => {
  convertReqBodyToLowercase(req);
  next();
};

