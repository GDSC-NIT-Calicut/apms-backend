-- Drop all tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS student_points CASCADE;
DROP TABLE IF EXISTS student_faculty_mapping CASCADE;
DROP TABLE IF EXISTS faculty_advisors CASCADE;
DROP TABLE IF EXISTS event_organizers CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS submission_status_enum CASCADE;
DROP TYPE IF EXISTS point_category_enum CASCADE;

-- Create ENUM types
CREATE TYPE user_role_enum AS ENUM ('student', 'faculty_advisor', 'event_organizer', 'admin');
CREATE TYPE submission_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE point_category_enum AS ENUM ('institute_level', 'department_level', 'fa_assigned');

-- USER table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- STUDENT table
CREATE TABLE students (
    roll_number VARCHAR(20) PRIMARY KEY, -- B220123CS format
    student_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    program VARCHAR(20) NOT NULL CHECK (program IN ('btech', 'mtech', 'phd')),
    batch_year INTEGER NOT NULL,
    total_points INTEGER DEFAULT 0 CHECK (total_points >= 0),
    institute_level_points INTEGER DEFAULT 0 CHECK (institute_level_points >= 0),
    department_level_points INTEGER DEFAULT 0 CHECK (department_level_points >= 0),
    fa_assigned_points INTEGER DEFAULT 0 CHECK (fa_assigned_points >= 0),
    -- Enhanced graduation eligibility check (minimum 20 points each from institute and department)
    graduation_eligible BOOLEAN GENERATED ALWAYS AS (
        total_points >= 80 AND 
        institute_level_points >= 20 AND 
        department_level_points >= 20
    ) STORED
);

-- FACULTY_ADVISOR table
CREATE TABLE faculty_advisors (
    fa_id SERIAL PRIMARY KEY,
    fa_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL
);

-- Student-Faculty Advisor mapping table
CREATE TABLE student_faculty_mapping (
    mapping_id SERIAL PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    fa_id INTEGER NOT NULL REFERENCES faculty_advisors(fa_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(student_roll_number, fa_id)
);

-- EVENT_ORGANIZER table
CREATE TABLE event_organizers (
    organizer_id SERIAL PRIMARY KEY,
    organizer_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL
);

-- ADMIN table
CREATE TABLE admins (
    admin_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    admin_name VARCHAR(255) NOT NULL
);

-- STUDENT_POINTS table with resubmission support
CREATE TABLE student_points (
    point_id SERIAL PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_type point_category_enum NOT NULL, -- institute_level, department_level, fa_assigned
    proof_document TEXT, -- PDF file path/URL (can be null for admin/organizer allocations)
    points INTEGER NOT NULL CHECK (points > 0),
    status submission_status_enum DEFAULT 'PENDING',
    event_date DATE NOT NULL,
    submission_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rejection_reason TEXT DEFAULT NULL,
    -- New field to track resubmission attempts
    attempt_number INTEGER DEFAULT 1 CHECK (attempt_number > 0),
    -- Reference to previous submission (for tracking resubmission chain)
    previous_submission_id INTEGER REFERENCES student_points(point_id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_department ON students(department);
CREATE INDEX idx_students_batch_year ON students(batch_year);
CREATE INDEX idx_students_graduation_eligible ON students(graduation_eligible);
CREATE INDEX idx_faculty_advisors_user_id ON faculty_advisors(user_id);
CREATE INDEX idx_faculty_advisors_department ON faculty_advisors(department);
CREATE INDEX idx_student_faculty_mapping_student ON student_faculty_mapping(student_roll_number);
CREATE INDEX idx_student_faculty_mapping_fa ON student_faculty_mapping(fa_id);
CREATE INDEX idx_student_faculty_mapping_active ON student_faculty_mapping(is_active);
CREATE INDEX idx_event_organizers_user_id ON event_organizers(user_id);
CREATE INDEX idx_admins_user_id ON admins(user_id);
CREATE INDEX idx_student_points_student ON student_points(student_roll_number);
CREATE INDEX idx_student_points_status ON student_points(status);
CREATE INDEX idx_student_points_event_type ON student_points(event_type);
CREATE INDEX idx_student_points_event_date ON student_points(event_date);
CREATE INDEX idx_student_points_submission_date ON student_points(submission_date);
CREATE INDEX idx_student_points_attempt ON student_points(attempt_number);

-- MODIFIED: Unique partial index - only prevents duplicate APPROVED submissions
-- This allows resubmission after rejection
CREATE UNIQUE INDEX unique_approved_points_per_event_per_student
ON student_points(student_roll_number, event_name)
WHERE status = 'APPROVED';

-- NEW: Additional constraint to prevent multiple PENDING submissions for same event
-- This prevents spam submissions while allowing resubmission after rejection
CREATE UNIQUE INDEX unique_pending_points_per_event_per_student
ON student_points(student_roll_number, event_name)
WHERE status = 'PENDING';

-- Trigger function to update student points
CREATE OR REPLACE FUNCTION update_student_point_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'APPROVED' THEN
        -- Add points when new approved record is created
        UPDATE students 
        SET 
            total_points = total_points + NEW.points,
            institute_level_points = CASE WHEN NEW.event_type = 'institute_level' 
                THEN institute_level_points + NEW.points ELSE institute_level_points END,
            department_level_points = CASE WHEN NEW.event_type = 'department_level' 
                THEN department_level_points + NEW.points ELSE department_level_points END,
            fa_assigned_points = CASE WHEN NEW.event_type = 'fa_assigned' 
                THEN fa_assigned_points + NEW.points ELSE fa_assigned_points END
        WHERE roll_number = NEW.student_roll_number;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.status != 'APPROVED' AND NEW.status = 'APPROVED' THEN
        -- Add points when status changes to approved
        UPDATE students 
        SET 
            total_points = total_points + NEW.points,
            institute_level_points = CASE WHEN NEW.event_type = 'institute_level' 
                THEN institute_level_points + NEW.points ELSE institute_level_points END,
            department_level_points = CASE WHEN NEW.event_type = 'department_level' 
                THEN department_level_points + NEW.points ELSE department_level_points END,
            fa_assigned_points = CASE WHEN NEW.event_type = 'fa_assigned' 
                THEN fa_assigned_points + NEW.points ELSE fa_assigned_points END
        WHERE roll_number = NEW.student_roll_number;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND NEW.status != 'APPROVED' THEN
        -- Subtract points when approval is revoked
        UPDATE students 
        SET 
            total_points = total_points - OLD.points,
            institute_level_points = CASE WHEN OLD.event_type = 'institute_level' 
                THEN institute_level_points - OLD.points ELSE institute_level_points END,
            department_level_points = CASE WHEN OLD.event_type = 'department_level' 
                THEN department_level_points - OLD.points ELSE department_level_points END,
            fa_assigned_points = CASE WHEN OLD.event_type = 'fa_assigned' 
                THEN fa_assigned_points - OLD.points ELSE fa_assigned_points END
        WHERE roll_number = OLD.student_roll_number;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND NEW.status = 'APPROVED' AND OLD.points != NEW.points THEN
        -- Handle point value changes for approved records
        UPDATE students 
        SET 
            total_points = total_points - OLD.points + NEW.points,
            institute_level_points = CASE 
                WHEN OLD.event_type = 'institute_level' THEN institute_level_points - OLD.points
                ELSE institute_level_points END +
                CASE WHEN NEW.event_type = 'institute_level' THEN NEW.points ELSE 0 END,
            department_level_points = CASE 
                WHEN OLD.event_type = 'department_level' THEN department_level_points - OLD.points
                ELSE department_level_points END +
                CASE WHEN NEW.event_type = 'department_level' THEN NEW.points ELSE 0 END,
            fa_assigned_points = CASE 
                WHEN OLD.event_type = 'fa_assigned' THEN fa_assigned_points - OLD.points
                ELSE fa_assigned_points END +
                CASE WHEN NEW.event_type = 'fa_assigned' THEN NEW.points ELSE 0 END
        WHERE roll_number = NEW.student_roll_number;
        
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'APPROVED' THEN
        -- Subtract points when approved record is deleted
        UPDATE students 
        SET 
            total_points = total_points - OLD.points,
            institute_level_points = CASE WHEN OLD.event_type = 'institute_level' 
                THEN institute_level_points - OLD.points ELSE institute_level_points END,
            department_level_points = CASE WHEN OLD.event_type = 'department_level' 
                THEN department_level_points - OLD.points ELSE department_level_points END,
            fa_assigned_points = CASE WHEN OLD.event_type = 'fa_assigned' 
                THEN fa_assigned_points - OLD.points ELSE fa_assigned_points END
        WHERE roll_number = OLD.student_roll_number;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for student points
CREATE TRIGGER trigger_update_student_point_totals
    AFTER INSERT OR UPDATE OR DELETE ON student_points
    FOR EACH ROW
    EXECUTE FUNCTION update_student_point_totals();

-- Function to handle resubmission logic
CREATE OR REPLACE FUNCTION handle_resubmission()
RETURNS TRIGGER AS $$
DECLARE
    last_submission_id INTEGER;
    last_attempt_number INTEGER;
BEGIN
    -- Only for INSERT operations
    IF TG_OP = 'INSERT' THEN
        -- Check if there's a previous submission for the same event
        SELECT point_id, attempt_number 
        INTO last_submission_id, last_attempt_number
        FROM student_points 
        WHERE student_roll_number = NEW.student_roll_number 
        AND event_name = NEW.event_name 
        AND status = 'REJECTED'
        ORDER BY submission_date DESC 
        LIMIT 1;
        
        -- If there's a previous rejected submission, link it and increment attempt number
        IF last_submission_id IS NOT NULL THEN
            NEW.previous_submission_id := last_submission_id;
            NEW.attempt_number := last_attempt_number + 1;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle resubmission tracking
CREATE TRIGGER trigger_handle_resubmission
    BEFORE INSERT ON student_points
    FOR EACH ROW
    EXECUTE FUNCTION handle_resubmission();

-- Enhanced views
CREATE VIEW student_eligibility_status AS
SELECT 
    s.roll_number,
    s.student_name,
    u.email,
    s.department,
    s.program,
    s.batch_year,
    s.total_points,
    s.institute_level_points,
    s.department_level_points,
    s.fa_assigned_points,
    s.graduation_eligible,
    -- Calculate remaining points needed
    GREATEST(0, 80 - s.total_points) as total_points_needed,
    GREATEST(0, 20 - s.institute_level_points) as institute_points_needed,
    GREATEST(0, 20 - s.department_level_points) as department_points_needed,
    -- Status messages
    CASE 
        WHEN s.total_points >= 80 THEN 'Met'
        ELSE 'Need ' || (80 - s.total_points) || ' more points'
    END as total_points_status,
    CASE 
        WHEN s.institute_level_points >= 20 THEN 'Met'
        ELSE 'Need ' || (20 - s.institute_level_points) || ' more points'
    END as institute_points_status,
    CASE 
        WHEN s.department_level_points >= 20 THEN 'Met'
        ELSE 'Need ' || (20 - s.department_level_points) || ' more points'
    END as department_points_status
FROM students s
JOIN users u ON s.user_id = u.user_id;

-- View for resubmission tracking
CREATE VIEW student_submission_history AS
SELECT 
    sp.point_id,
    sp.student_roll_number,
    s.student_name,
    sp.event_name,
    sp.event_type,
    sp.points,
    sp.status,
    sp.event_date,
    sp.submission_date,
    sp.attempt_number,
    sp.rejection_reason,
    sp.previous_submission_id,
    -- Check if this is a resubmission
    CASE WHEN sp.previous_submission_id IS NOT NULL THEN TRUE ELSE FALSE END as is_resubmission,
    -- Get previous attempt details
    prev_sp.status as previous_status,
    prev_sp.rejection_reason as previous_rejection_reason,
    prev_sp.submission_date as previous_submission_date
FROM student_points sp
JOIN students s ON sp.student_roll_number = s.roll_number
LEFT JOIN student_points prev_sp ON sp.previous_submission_id = prev_sp.point_id
ORDER BY sp.student_roll_number, sp.event_name, sp.attempt_number;

-- View for faculty dashboard with resubmission info
CREATE VIEW fa_dashboard_enhanced AS
SELECT 
    fa.fa_id,
    fa.fa_name,
    u.email as fa_email,
    fa.department,
    COUNT(sfm.student_roll_number) as total_students_assigned,
    COUNT(CASE WHEN s.graduation_eligible THEN 1 END) as eligible_students,
    COUNT(CASE WHEN sp.status = 'PENDING' THEN 1 END) as pending_submissions,
    COUNT(CASE WHEN sp.status = 'PENDING' AND sp.attempt_number > 1 THEN 1 END) as pending_resubmissions
FROM faculty_advisors fa
JOIN users u ON fa.user_id = u.user_id
LEFT JOIN student_faculty_mapping sfm ON fa.fa_id = sfm.fa_id AND sfm.is_active = TRUE
LEFT JOIN students s ON sfm.student_roll_number = s.roll_number
LEFT JOIN student_points sp ON s.roll_number = sp.student_roll_number
GROUP BY fa.fa_id, fa.fa_name, u.email, fa.department;

-- Comments for documentation
COMMENT ON TABLE users IS 'Main user table storing authentication and basic user information';
COMMENT ON TABLE students IS 'Student-specific information with activity point tracking';
COMMENT ON TABLE faculty_advisors IS 'Faculty advisor information';
COMMENT ON TABLE student_faculty_mapping IS 'Many-to-many mapping between students and faculty advisors';
COMMENT ON TABLE event_organizers IS 'Event organizer information';
COMMENT ON TABLE admins IS 'System administrator information';
COMMENT ON TABLE student_points IS 'Unified table for all student point allocations and submissions with resubmission support';
COMMENT ON COLUMN student_points.attempt_number IS 'Tracks the number of submission attempts for the same event';
COMMENT ON COLUMN student_points.previous_submission_id IS 'References the previous submission for resubmission tracking';
COMMENT ON INDEX unique_approved_points_per_event_per_student IS 'Prevents multiple approved submissions for the same event';
COMMENT ON INDEX unique_pending_points_per_event_per_student IS 'Prevents multiple pending submissions for the same event (anti-spam)';
COMMENT ON VIEW student_submission_history IS 'Complete history of submissions including resubmission tracking';
