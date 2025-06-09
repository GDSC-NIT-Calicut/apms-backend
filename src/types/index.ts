import { Request } from 'express';

export type UserRole = 'student' | 'faculty_advisor' | 'event_organizer' | 'admin';

export interface User {
  user_id: number;
  email: string;
  role: UserRole;
  created_at?: Date; // Optional, set by DB
}

export interface Student {
  roll_number: string;
  student_name: string;
  user_id: number;
  department: string;
  program: 'btech' | 'mtech' | 'phd';
  batch_year: number;
  total_points: number;
  institute_level_points: number;
  department_level_points: number;
  fa_assigned_points: number;
  graduation_eligible: boolean;
}

export interface FacultyAdvisor {
  fa_id: number;
  fa_name: string;
  user_id: number;
  department: string;
}

export interface EventOrganizer {
  organizer_id: number;
  organizer_name: string;
  user_id: number;
  organization_name: string;
}

export interface Admin {
  admin_id: number;
  user_id: number;
  admin_name: string;
}

export interface StudentPoints {
  point_id: number;
  student_roll_number: string;
  event_name: string;
  event_type: 'institute_level' | 'department_level' | 'fa_assigned';
  proof_document?: string;
  points: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  event_date: Date;
  event_description?: string;
  submission_date: Date;
  rejection_reason?: string;
  attempt_number: number;
  previous_submission_id?: number;
}

export interface AuthRequest extends Request {
  user?: {
    user_id: number;
    email: string;
    role: UserRole;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  role:UserRole;
}

export interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  department?: string;
  roll_number?: string;
  program?: 'btech' | 'mtech' | 'phd';
  batch_year?: number;
  organization_name?: string;
}

export interface JWTPayload {
  user_id: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string; // or 'name' if you prefer
  user: string;
  password: string;
}
