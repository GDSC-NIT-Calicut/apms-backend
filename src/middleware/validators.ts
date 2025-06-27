import { Request, Response, NextFunction } from 'express';
import { LoginCredentials,isUserRole } from '../types/index.js';

export const validateLoginInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password,role } = req.body as LoginCredentials;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email,role and password are required' });
  }

  if (typeof email !== 'string' || typeof password !== 'string' ||typeof role !== 'string' ||
    !isUserRole(role)) {
    return res.status(400).json({ message: 'Invalid input types' });
  }

  if (!email.endsWith('@nitc.ac.in')) {
    return res.status(400).json({ message: 'Only NITC emails allowed' });
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


export const validateRegisterInput = (req: Request, res: Response, next: NextFunction) => {
  const { email, password, role } = req.body;

  // Check email presence and type
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required and must be a string' });
  }

  // Check email domain
  // const nitcEmailRegex = /^[a-zA-Z0-9._%+-]+@nitc\.ac\.in$/;
  // if (!nitcEmailRegex.test(email)) {
  //   return res.status(400).json({ message: 'Email must be a valid @nitc.ac.in address' });
  // }
  if (!email.endsWith('@nitc.ac.in')) {
    return res.status(400).json({ message: 'Only NITC emails allowed' });
  }

  // Check password presence and type
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password is required and must be a string' });
  }

  // Check role validity
  if (!role || !isUserRole(role)) {
    return res.status(400).json({ message: 'Invalid or missing user role' });
  }

  next();
};


// --- Student registration validator ---
export const validateStudentFields = (req: Request, res: Response, next: NextFunction) => {
  const { roll_number, student_name, department, program, batch_year, fa_name } = req.body;

  // Check required fields
  if (!roll_number || !student_name || !department || !program || !batch_year || !fa_name) {
    return res.status(400).json({ message: 'Missing required student fields' });
  }

  // Validate types
  if (typeof roll_number !== 'string' || typeof student_name !== 'string' ||
      typeof department !== 'string' || typeof program !== 'string' ||
      typeof batch_year !== 'number' || typeof fa_name !== 'string') {
    return res.status(400).json({ message: 'Invalid type for one or more student fields' });
  }

  // Validate program
  if (!['btech', 'mtech', 'phd'].includes(program)) {
    return res.status(400).json({ message: 'Invalid program' });
  }

  // Validate department code
  if (!DEPARTMENT_CODES.includes(department)) {
    return res.status(400).json({ message: 'Invalid department code' });
  }

  // Validate roll number format
  const expectedPrefix = PROGRAM_PREFIX[program];
  const rollRegex = new RegExp(`^${expectedPrefix}\\d{6}${department}$`, 'i');
  if (!rollRegex.test(roll_number)) {
    return res.status(400).json({ message: `Invalid roll number format for program ${program} and department ${department}` });
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


