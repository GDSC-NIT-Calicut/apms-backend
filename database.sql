-- =========================================================================
-- APMS DATABASE SCHEMA INITIALIZATION
-- REVISION: Standardized atomic metrics state computation tracking.
-- =========================================================================

-- 1. Drop existing objects in reverse dependency order
DROP TRIGGER IF EXISTS trigger_update_student_point_totals ON student_points CASCADE;
DROP TRIGGER IF EXISTS trg_student_points_category_change ON student_points CASCADE;
DROP TRIGGER IF EXISTS trg_student_points_state_sync ON student_points CASCADE;

DROP FUNCTION IF EXISTS update_student_point_totals() CASCADE;
DROP FUNCTION IF EXISTS update_student_points_on_category_change() CASCADE;
DROP FUNCTION IF EXISTS update_student_point_totals_unified() CASCADE;

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

-- 2. Create ENUM types
CREATE TYPE user_role_enum AS ENUM ('student', 'faculty_advisor', 'event_organizer', 'admin');
CREATE TYPE submission_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE point_category_enum AS ENUM ('institute_level', 'department_level', 'fa_assigned');

-- 3. USER table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. STUDENT table
CREATE TABLE students (
    roll_number VARCHAR(20) PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL CHECK (department = LOWER(department)),
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

-- 5. FACULTY_ADVISOR table
CREATE TABLE faculty_advisors (
    fa_id SERIAL PRIMARY KEY,
    fa_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL CHECK (department = LOWER(department))
);

-- 6. Student-Faculty Advisor mapping table
CREATE TABLE student_faculty_mapping (
    mapping_id SERIAL PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE ON UPDATE CASCADE,
    fa_id INTEGER NOT NULL REFERENCES faculty_advisors(fa_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(student_roll_number, fa_id)
);

-- 7. EVENT_ORGANIZER table
CREATE TABLE event_organizers (
    organizer_id SERIAL PRIMARY KEY,
    organizer_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL
);

-- 8. EVENT_ORGANIZER_ALLOCATIONS table
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

-- 9. ADMIN table
CREATE TABLE admins (
    admin_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    admin_name VARCHAR(255) NOT NULL
);

-- 10. STUDENT_POINTS table
CREATE TABLE student_points (
    point_id SERIAL PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE ON UPDATE CASCADE,
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

-- =========================================================================
-- DATA SEEDING: SYSTEM INVARIANTS & DUMMY MANAGEMENT PROFILES
-- =========================================================================

INSERT INTO users (email, role)
VALUES ('[email protected]', 'faculty_advisor')
ON CONFLICT (email) DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'no fa assigned', user_id, 'cs' FROM users WHERE email = '[email protected]' ON CONFLICT DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'no fa assigned', user_id, 'ec' FROM users WHERE email = '[email protected]' ON CONFLICT DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'no fa assigned', user_id, 'ee' FROM users WHERE email = '[email protected]' ON CONFLICT DO NOTHING;

INSERT INTO faculty_advisors (fa_name, user_id, department)
SELECT 'no fa assigned', user_id, 'me' FROM users WHERE email = '[email protected]' ON CONFLICT DO NOTHING;

-- =========================================================================
-- OPTIMIZATION PATHS: ARCHITECTURAL PERFORMANCE INDEXES
-- =========================================================================
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

-- Enforces uniqueness constraints scoped strictly per student per distinct calendar date
CREATE UNIQUE INDEX unique_approved_points_per_event_per_student ON student_points(student_roll_number, event_name, event_date) WHERE status = 'APPROVED';
CREATE UNIQUE INDEX unique_pending_points_per_event_per_student ON student_points(student_roll_number, event_name, event_date) WHERE status = 'PENDING';

-- =========================================================================
-- STATE SYNCHRONIZATION ENGINE (TRIGGERS & CALCULATION LOGIC)
-- =========================================================================

CREATE OR REPLACE FUNCTION update_student_point_totals_unified()
RETURNS TRIGGER AS $$
DECLARE
    v_roll_number VARCHAR(20);
    v_old_points INT := 0;
    v_new_points INT := 0;
BEGIN
    -- Isolate metric integers securely based on execution block to avoid NULL calculation overrides
    IF TG_OP = 'DELETE' THEN
        v_roll_number := OLD.student_roll_number;
        IF OLD.status = 'APPROVED' THEN v_old_points := OLD.points; END IF;
    ELSIF TG_OP = 'INSERT' THEN
        v_roll_number := NEW.student_roll_number;
        IF NEW.status = 'APPROVED' THEN v_new_points := NEW.points; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        v_roll_number := NEW.student_roll_number;
        IF OLD.status = 'APPROVED' THEN v_old_points := OLD.points; END IF;
        IF NEW.status = 'APPROVED' THEN v_new_points := NEW.points; END IF;
    END IF;

    -- Synchronize updates across master aggregate table layout
    UPDATE students
    SET
        total_points = COALESCE(total_points, 0) - v_old_points + v_new_points,
            
        institute_level_points = COALESCE(institute_level_points, 0) 
            - (CASE WHEN TG_OP <> 'INSERT' AND OLD.event_type = 'institute_level' AND OLD.status = 'APPROVED' THEN OLD.points ELSE 0 END)
            + (CASE WHEN TG_OP <> 'DELETE' AND NEW.event_type = 'institute_level' AND NEW.status = 'APPROVED' THEN NEW.points ELSE 0 END),
            
        department_level_points = COALESCE(department_level_points, 0) 
            - (CASE WHEN TG_OP <> 'INSERT' AND OLD.event_type = 'department_level' AND OLD.status = 'APPROVED' THEN OLD.points ELSE 0 END)
            + (CASE WHEN TG_OP <> 'DELETE' AND NEW.event_type = 'department_level' AND NEW.status = 'APPROVED' THEN NEW.points ELSE 0 END),
            
        fa_assigned_points = COALESCE(fa_assigned_points, 0) 
            - (CASE WHEN TG_OP <> 'INSERT' AND OLD.event_type = 'fa_assigned' AND OLD.status = 'APPROVED' THEN OLD.points ELSE 0 END)
            + (CASE WHEN TG_OP <> 'DELETE' AND NEW.event_type = 'fa_assigned' AND NEW.status = 'APPROVED' THEN NEW.points ELSE 0 END)
    WHERE roll_number = v_roll_number;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Hook single point-of-truth transaction synchronization trigger
CREATE TRIGGER trg_student_points_state_sync
    AFTER INSERT OR UPDATE OR DELETE ON student_points
    FOR EACH ROW 
    EXECUTE FUNCTION update_student_point_totals_unified();