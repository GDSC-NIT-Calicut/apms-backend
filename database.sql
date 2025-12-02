-- updated resubmission logic for student_points
-- Drop existing objects in reverse dependency order
DROP TRIGGER IF EXISTS trigger_update_student_point_totals ON student_points CASCADE;
DROP TRIGGER IF EXISTS trg_student_points_category_change ON student_points CASCADE;

DROP FUNCTION IF EXISTS update_student_point_totals() CASCADE;
DROP FUNCTION IF EXISTS update_student_points_on_category_change() CASCADE;

DROP VIEW IF EXISTS student_eligibility_status CASCADE;
DROP VIEW IF EXISTS student_submission_history CASCADE;
DROP VIEW IF EXISTS fa_dashboard_enhanced CASCADE;

DROP TABLE IF EXISTS student_points CASCADE;
DROP TABLE IF EXISTS student_faculty_mapping CASCADE;
DROP TABLE IF EXISTS event_organizer_allocations CASCADE;
DROP TABLE IF EXISTS faculty_advisors CASCADE;
DROP TABLE IF EXISTS event_organizers CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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
    role user_role_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- STUDENT table
CREATE TABLE students (
    roll_number VARCHAR(20) PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    program VARCHAR(20) NOT NULL CHECK (program IN ('btech', 'mtech', 'phd')),
    batch_year INTEGER NOT NULL,
    total_points INTEGER DEFAULT 0 CHECK (total_points >= 0),
    institute_level_points INTEGER DEFAULT 0 CHECK (institute_level_points >= 0),
    department_level_points INTEGER DEFAULT 0 CHECK (department_level_points >= 0),
    fa_assigned_points INTEGER DEFAULT 0 CHECK (fa_assigned_points >= 0),
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

-- EVENT_ORGANIZER_ALLOCATIONS table
CREATE TABLE event_organizer_allocations (
    allocation_id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('allocated', 'revoked')),
    event_name VARCHAR(255) NOT NULL,
    event_type point_category_enum NOT NULL,
    event_date DATE NOT NULL
);

-- ADMIN table
CREATE TABLE admins (
    admin_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    admin_name VARCHAR(255) NOT NULL
);

-- STUDENT_POINTS table (revised)
CREATE TABLE student_points (
    point_id SERIAL PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_type point_category_enum NOT NULL,
    proof_document TEXT,
    points INTEGER NOT NULL CHECK (points > 0),
    status submission_status_enum DEFAULT 'PENDING',
    event_date DATE NOT NULL,
    submission_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rejection_reason TEXT DEFAULT NULL,
    resubmitted BOOLEAN DEFAULT FALSE
);

-- this for handling removal of faculty advisor
-- Insert dummy user for "No FA Assigned" faculty advisor
INSERT INTO users (email, role)
VALUES ('[email protected]', 'faculty_advisor')
ON CONFLICT (email) DO NOTHING;

-- Insert dummy faculty advisor for each department (repeat for all departments)
INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'No FA Assigned', user_id, 'CS'
FROM users WHERE email = '[email protected]'
ON CONFLICT DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'No FA Assigned', user_id, 'EC'
FROM users WHERE email = '[email protected]'
ON CONFLICT DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'No FA Assigned', user_id, 'EE'
FROM users WHERE email = '[email protected]'
ON CONFLICT DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'No FA Assigned', user_id, 'ME'
FROM users WHERE email = '[email protected]'
ON CONFLICT DO NOTHING;

-- Repeat for all departments in your DEPARTMENT_CODES

-- Create indexes
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

-- Unique constraints
CREATE UNIQUE INDEX unique_approved_points_per_event_per_student
ON student_points(student_roll_number, event_name)
WHERE status = 'APPROVED';

CREATE UNIQUE INDEX unique_pending_points_per_event_per_student
ON student_points(student_roll_number, event_name)
WHERE status = 'PENDING';

-- 1. Function to update student point totals
CREATE OR REPLACE FUNCTION update_student_point_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'APPROVED' THEN
            UPDATE students
            SET
                total_points = total_points + NEW.points,
                institute_level_points = institute_level_points + 
                    CASE WHEN NEW.event_type = 'institute_level' THEN NEW.points ELSE 0 END,
                department_level_points = department_level_points + 
                    CASE WHEN NEW.event_type = 'department_level' THEN NEW.points ELSE 0 END,
                fa_assigned_points = fa_assigned_points + 
                    CASE WHEN NEW.event_type = 'fa_assigned' THEN NEW.points ELSE 0 END
            WHERE roll_number = NEW.student_roll_number;
        END IF;
        
    -- Handle UPDATE
    ELSIF TG_OP = 'UPDATE' THEN
        -- If status changed from APPROVED to something else
        IF OLD.status = 'APPROVED' AND NEW.status != 'APPROVED' THEN
            UPDATE students
            SET
                total_points = total_points - OLD.points,
                institute_level_points = institute_level_points - 
                    CASE WHEN OLD.event_type = 'institute_level' THEN OLD.points ELSE 0 END,
                department_level_points = department_level_points - 
                    CASE WHEN OLD.event_type = 'department_level' THEN OLD.points ELSE 0 END,
                fa_assigned_points = fa_assigned_points - 
                    CASE WHEN OLD.event_type = 'fa_assigned' THEN OLD.points ELSE 0 END
            WHERE roll_number = OLD.student_roll_number;
        
        -- If status changed to APPROVED
        ELSIF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
            UPDATE students
            SET
                total_points = total_points + NEW.points,
                institute_level_points = institute_level_points + 
                    CASE WHEN NEW.event_type = 'institute_level' THEN NEW.points ELSE 0 END,
                department_level_points = department_level_points + 
                    CASE WHEN NEW.event_type = 'department_level' THEN NEW.points ELSE 0 END,
                fa_assigned_points = fa_assigned_points + 
                    CASE WHEN NEW.event_type = 'fa_assigned' THEN NEW.points ELSE 0 END
            WHERE roll_number = NEW.student_roll_number;
        
        -- If points changed while approved
        ELSIF OLD.status = 'APPROVED' AND NEW.status = 'APPROVED' AND OLD.points != NEW.points THEN
            -- First remove old points
            UPDATE students
            SET
                total_points = total_points - OLD.points,
                institute_level_points = institute_level_points - 
                    CASE WHEN OLD.event_type = 'institute_level' THEN OLD.points ELSE 0 END,
                department_level_points = department_level_points - 
                    CASE WHEN OLD.event_type = 'department_level' THEN OLD.points ELSE 0 END,
                fa_assigned_points = fa_assigned_points - 
                    CASE WHEN OLD.event_type = 'fa_assigned' THEN OLD.points ELSE 0 END
            WHERE roll_number = OLD.student_roll_number;
            
            -- Then add new points
            UPDATE students
            SET
                total_points = total_points + NEW.points,
                institute_level_points = institute_level_points + 
                    CASE WHEN NEW.event_type = 'institute_level' THEN NEW.points ELSE 0 END,
                department_level_points = department_level_points + 
                    CASE WHEN NEW.event_type = 'department_level' THEN NEW.points ELSE 0 END,
                fa_assigned_points = fa_assigned_points + 
                    CASE WHEN NEW.event_type = 'fa_assigned' THEN NEW.points ELSE 0 END
            WHERE roll_number = NEW.student_roll_number;
        END IF;
        
    -- Handle DELETE
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'APPROVED' THEN
            UPDATE students
            SET
                total_points = total_points - OLD.points,
                institute_level_points = institute_level_points - 
                    CASE WHEN OLD.event_type = 'institute_level' THEN OLD.points ELSE 0 END,
                department_level_points = department_level_points - 
                    CASE WHEN OLD.event_type = 'department_level' THEN OLD.points ELSE 0 END,
                fa_assigned_points = fa_assigned_points - 
                    CASE WHEN OLD.event_type = 'fa_assigned' THEN OLD.points ELSE 0 END
            WHERE roll_number = OLD.student_roll_number;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for student points
CREATE TRIGGER trigger_update_student_point_totals
    AFTER INSERT OR UPDATE OR DELETE ON student_points
    FOR EACH ROW
    EXECUTE FUNCTION update_student_point_totals();

-- 2. Function to handle category changes
CREATE OR REPLACE FUNCTION update_student_points_on_category_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if status is APPROVED and event_type changed
    IF NEW.status = 'APPROVED' AND OLD.event_type IS DISTINCT FROM NEW.event_type THEN
        -- Subtract points from old category
        UPDATE students
        SET
            total_points = total_points - OLD.points,
            institute_level_points = CASE 
                WHEN OLD.event_type = 'institute_level' THEN institute_level_points - OLD.points 
                ELSE institute_level_points 
            END,
            department_level_points = CASE 
                WHEN OLD.event_type = 'department_level' THEN department_level_points - OLD.points 
                ELSE department_level_points 
            END,
            fa_assigned_points = CASE 
                WHEN OLD.event_type = 'fa_assigned' THEN fa_assigned_points - OLD.points 
                ELSE fa_assigned_points 
            END
        WHERE roll_number = OLD.student_roll_number;
        
        -- Add points to new category
        UPDATE students
        SET
            total_points = total_points + NEW.points,
            institute_level_points = CASE 
                WHEN NEW.event_type = 'institute_level' THEN institute_level_points + NEW.points 
                ELSE institute_level_points 
            END,
            department_level_points = CASE 
                WHEN NEW.event_type = 'department_level' THEN department_level_points + NEW.points 
                ELSE department_level_points 
            END,
            fa_assigned_points = CASE 
                WHEN NEW.event_type = 'fa_assigned' THEN fa_assigned_points + NEW.points 
                ELSE fa_assigned_points 
            END
        WHERE roll_number = NEW.student_roll_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for category changes
CREATE TRIGGER trg_student_points_category_change
AFTER UPDATE OF event_type, status ON student_points
FOR EACH ROW
WHEN (
    OLD.status = 'APPROVED' OR 
    NEW.status = 'APPROVED'
)
EXECUTE FUNCTION update_student_points_on_category_change();

-- 4. Views
CREATE VIEW student_eligibility_status AS
SELECT 
    s.roll_number,
    s.student_name,
    s.department,
    s.batch_year,
    s.total_points,
    s.institute_level_points,
    s.department_level_points,
    s.fa_assigned_points,
    s.graduation_eligible,
    CASE 
        WHEN s.graduation_eligible THEN 'ELIGIBLE'
        ELSE 'NOT_ELIGIBLE'
    END AS eligibility_status
FROM students s;

CREATE VIEW student_submission_history AS
SELECT 
    sp.student_roll_number,
    sp.event_name,
    sp.event_type,
    sp.points,
    sp.status,
    sp.event_date,
    sp.submission_date,
    sp.rejection_reason,
    sp.resubmitted,
    s.student_name,
    s.department
FROM student_points sp
JOIN students s ON sp.student_roll_number = s.roll_number;

CREATE VIEW fa_dashboard_enhanced AS
SELECT 
    fa.fa_id,
    fa.fa_name,
    fa.department,
    COUNT(DISTINCT sfm.student_roll_number) AS total_students,
    COUNT(DISTINCT CASE WHEN s.graduation_eligible THEN s.roll_number END) AS eligible_students,
    COALESCE(SUM(sp.points), 0) AS total_points_managed,
    AVG(s.total_points) AS avg_points_per_student
FROM faculty_advisors fa
LEFT JOIN student_faculty_mapping sfm ON fa.fa_id = sfm.fa_id AND sfm.is_active = TRUE
LEFT JOIN students s ON sfm.student_roll_number = s.roll_number
LEFT JOIN student_points sp ON s.roll_number = sp.student_roll_number AND sp.status = 'APPROVED'
GROUP BY fa.fa_id, fa.fa_name, fa.department;
