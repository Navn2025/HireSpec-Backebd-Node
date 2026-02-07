-- Assessment & Selection Portal Database Schema
-- Comprehensive schema for Companies and Candidates

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    role ENUM('candidate', 'company_admin', 'company_hr', 'admin') NOT NULL DEFAULT 'candidate',
    profile_image VARCHAR(500),
    face_embedding TEXT,
    resume_url VARCHAR(500),
    resume_filename VARCHAR(255),
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    current_company VARCHAR(255),
    current_role VARCHAR(255),
    experience_years INT DEFAULT 0,
    skills_json JSON,
    education_json JSON,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
);

-- =============================================
-- OTP CODES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    purpose ENUM('register', 'forgot_password', 'email_verify') NOT NULL DEFAULT 'register',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    INDEX idx_email_otp (email, otp),
    INDEX idx_expires (expires_at)
);

-- =============================================
-- COMPANIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    company_size ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+') DEFAULT '1-10',
    website VARCHAR(500),
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    headquarters VARCHAR(255),
    founded_year INT,
    linkedin_url VARCHAR(500),
    twitter_url VARCHAR(500),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    settings_json JSON,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_industry (industry),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- COMPANY MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS company_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'admin', 'hr', 'interviewer', 'viewer') NOT NULL DEFAULT 'viewer',
    department VARCHAR(100),
    title VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    invited_by_user_id INT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_user (company_id, user_id),
    INDEX idx_company (company_id),
    INDEX idx_user (user_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- JOBS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    created_by_user_id INT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    requirements TEXT,
    responsibilities TEXT,
    job_type ENUM('full-time', 'part-time', 'contract', 'internship', 'freelance') DEFAULT 'full-time',
    experience_level ENUM('entry', 'mid', 'senior', 'lead', 'executive') DEFAULT 'mid',
    min_experience_years INT DEFAULT 0,
    max_experience_years INT,
    salary_min DECIMAL(12, 2),
    salary_max DECIMAL(12, 2),
    salary_currency VARCHAR(3) DEFAULT 'USD',
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT FALSE,
    skills_required_json JSON,
    skills_preferred_json JSON,
    benefits_json JSON,
    assessment_modules_json JSON,
    total_positions INT DEFAULT 1,
    filled_positions INT DEFAULT 0,
    status ENUM('draft', 'published', 'paused', 'closed', 'archived') DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    closes_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company (company_id),
    INDEX idx_status (status),
    INDEX idx_job_type (job_type),
    INDEX idx_experience_level (experience_level),
    INDEX idx_location (location),
    INDEX idx_is_remote (is_remote),
    INDEX idx_published_at (published_at),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- APPLICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    candidate_user_id INT NOT NULL,
    status ENUM('applied', 'screening', 'assessment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn') DEFAULT 'applied',
    cover_letter TEXT,
    resume_url VARCHAR(500),
    expected_salary DECIMAL(12, 2),
    notice_period_days INT,
    availability_date DATE,
    referral_source VARCHAR(100),
    notes TEXT,
    recruiter_notes TEXT,
    screening_score DECIMAL(5, 2),
    total_score DECIMAL(5, 2),
    is_starred BOOLEAN DEFAULT FALSE,
    reviewed_by_user_id INT,
    reviewed_at TIMESTAMP NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_job_candidate (job_id, candidate_user_id),
    INDEX idx_job (job_id),
    INDEX idx_candidate (candidate_user_id),
    INDEX idx_status (status),
    INDEX idx_applied_at (applied_at),
    INDEX idx_is_starred (is_starred),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- QUESTION BANKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS question_banks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('technical', 'aptitude', 'coding', 'behavioral', 'custom') NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company (company_id),
    INDEX idx_category (category),
    INDEX idx_is_public (is_public),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- QUESTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bank_id INT,
    company_id INT,
    question_type ENUM('mcq', 'multiple_select', 'true_false', 'short_answer', 'long_answer', 'coding', 'file_upload') NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    options_json JSON,
    correct_answer_json JSON,
    explanation TEXT,
    code_template TEXT,
    code_language VARCHAR(50),
    test_cases_json JSON,
    time_limit_seconds INT DEFAULT 60,
    points INT DEFAULT 10,
    tags_json JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bank (bank_id),
    INDEX idx_company (company_id),
    INDEX idx_type (question_type),
    INDEX idx_difficulty (difficulty),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- ASSESSMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    assessment_type ENUM('screening', 'technical', 'coding', 'aptitude', 'behavioral', 'comprehensive') DEFAULT 'technical',
    duration_minutes INT DEFAULT 60,
    passing_score DECIMAL(5, 2) DEFAULT 60,
    max_attempts INT DEFAULT 1,
    is_proctored BOOLEAN DEFAULT TRUE,
    proctoring_settings_json JSON,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    show_results BOOLEAN DEFAULT FALSE,
    questions_config_json JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job (job_id),
    INDEX idx_type (assessment_type),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- ASSESSMENT QUESTIONS TABLE (Junction)
-- =============================================
CREATE TABLE IF NOT EXISTS assessment_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id INT NOT NULL,
    question_id INT NOT NULL,
    order_index INT DEFAULT 0,
    is_required BOOLEAN DEFAULT TRUE,
    custom_points INT,
    custom_time_limit_seconds INT,
    UNIQUE KEY uq_assessment_question (assessment_id, question_id),
    INDEX idx_assessment (assessment_id),
    INDEX idx_question (question_id),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- =============================================
-- ASSESSMENT INVITATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS assessment_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id INT NOT NULL,
    application_id INT,
    candidate_user_id INT,
    invited_email VARCHAR(255) NOT NULL,
    invite_token VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('pending', 'sent', 'opened', 'started', 'completed', 'expired', 'cancelled') DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP NULL,
    opened_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    reminder_count INT DEFAULT 0,
    last_reminder_at TIMESTAMP NULL,
    invited_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_assessment (assessment_id),
    INDEX idx_application (application_id),
    INDEX idx_candidate (candidate_user_id),
    INDEX idx_email (invited_email),
    INDEX idx_token (invite_token),
    INDEX idx_status (status),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
    FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- ASSESSMENT ATTEMPTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invitation_id INT NOT NULL,
    assessment_id INT NOT NULL,
    candidate_user_id INT NOT NULL,
    attempt_number INT DEFAULT 1,
    status ENUM('in_progress', 'completed', 'submitted', 'timed_out', 'terminated', 'graded') DEFAULT 'in_progress',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    time_spent_seconds INT DEFAULT 0,
    score DECIMAL(5, 2),
    percentage DECIMAL(5, 2),
    passed BOOLEAN,
    total_questions INT DEFAULT 0,
    answered_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    partial_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    unanswered INT DEFAULT 0,
    proctoring_flags_count INT DEFAULT 0,
    proctoring_status ENUM('clean', 'flagged', 'suspicious', 'terminated') DEFAULT 'clean',
    browser_info_json JSON,
    ip_address VARCHAR(45),
    graded_by_user_id INT,
    graded_at TIMESTAMP NULL,
    feedback TEXT,
    INDEX idx_invitation (invitation_id),
    INDEX idx_assessment (assessment_id),
    INDEX idx_candidate (candidate_user_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at),
    INDEX idx_proctoring_status (proctoring_status),
    FOREIGN KEY (invitation_id) REFERENCES assessment_invitations(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- ATTEMPT ANSWERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS attempt_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_json JSON,
    code_submission TEXT,
    code_language VARCHAR(50),
    code_output TEXT,
    is_correct BOOLEAN,
    points_earned DECIMAL(5, 2),
    max_points DECIMAL(5, 2),
    time_spent_seconds INT DEFAULT 0,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    graded_at TIMESTAMP NULL,
    grader_feedback TEXT,
    INDEX idx_attempt (attempt_id),
    INDEX idx_question (question_id),
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- =============================================
-- PROCTORING LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS proctoring_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    candidate_user_id INT NOT NULL,
    event_type ENUM(
        'session_start', 'session_end',
        'tab_switch', 'tab_hidden', 'tab_visible',
        'fullscreen_exit', 'fullscreen_enter',
        'face_not_detected', 'multiple_faces', 'face_mismatch',
        'copy_paste', 'right_click', 'keyboard_shortcut',
        'screen_capture', 'browser_resize',
        'idle_detected', 'suspicious_behavior',
        'warning_issued', 'test_terminated',
        'snapshot_taken', 'audio_detected'
    ) NOT NULL,
    severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
    description TEXT,
    metadata_json JSON,
    snapshot_url VARCHAR(500),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attempt (attempt_id),
    INDEX idx_candidate (candidate_user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- INTERVIEW SCHEDULES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS interview_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    job_id INT NOT NULL,
    candidate_user_id INT NOT NULL,
    interview_type ENUM('phone', 'video', 'in_person', 'technical', 'hr', 'panel') NOT NULL,
    interview_round INT DEFAULT 1,
    title VARCHAR(255),
    description TEXT,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'UTC',
    meeting_link VARCHAR(500),
    meeting_id VARCHAR(100),
    meeting_password VARCHAR(100),
    location VARCHAR(500),
    status ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show') DEFAULT 'scheduled',
    interviewers_json JSON,
    notes TEXT,
    candidate_notes TEXT,
    created_by_user_id INT,
    confirmed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_application (application_id),
    INDEX idx_job (job_id),
    INDEX idx_candidate (candidate_user_id),
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_status (status),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- INTERVIEW FEEDBACK TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS interview_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interview_id INT NOT NULL,
    interviewer_user_id INT NOT NULL,
    overall_rating DECIMAL(3, 2),
    technical_rating DECIMAL(3, 2),
    communication_rating DECIMAL(3, 2),
    problem_solving_rating DECIMAL(3, 2),
    cultural_fit_rating DECIMAL(3, 2),
    recommendation ENUM('strong_hire', 'hire', 'maybe', 'no_hire', 'strong_no_hire'),
    strengths TEXT,
    weaknesses TEXT,
    detailed_feedback TEXT,
    questions_asked_json JSON,
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_interview (interview_id),
    INDEX idx_interviewer (interviewer_user_id),
    INDEX idx_recommendation (recommendation),
    FOREIGN KEY (interview_id) REFERENCES interview_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- CANDIDATE REPORTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS candidate_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    candidate_user_id INT NOT NULL,
    job_id INT NOT NULL,
    report_type ENUM('assessment', 'interview', 'comprehensive', 'ai_analysis') DEFAULT 'comprehensive',
    overall_score DECIMAL(5, 2),
    skill_scores_json JSON,
    assessment_summary_json JSON,
    interview_summary_json JSON,
    proctoring_summary_json JSON,
    ai_insights_json JSON,
    strengths_json JSON,
    areas_of_improvement_json JSON,
    recommendation ENUM('highly_recommended', 'recommended', 'neutral', 'not_recommended'),
    recruiter_notes TEXT,
    is_shared_with_candidate BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by_user_id INT,
    INDEX idx_application (application_id),
    INDEX idx_candidate (candidate_user_id),
    INDEX idx_job (job_id),
    INDEX idx_recommendation (recommendation),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM(
        'application_received', 'application_status', 'assessment_invite',
        'assessment_reminder', 'interview_scheduled', 'interview_reminder',
        'feedback_received', 'offer_extended', 'general'
    ) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link_url VARCHAR(500),
    metadata_json JSON,
    is_read BOOLEAN DEFAULT FALSE,
    is_email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- EMAIL TEMPLATES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    template_type ENUM(
        'application_received', 'application_rejected', 'assessment_invite',
        'assessment_reminder', 'interview_invite', 'interview_reminder',
        'offer_letter', 'rejection', 'custom'
    ) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables_json JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company (company_id),
    INDEX idx_type (template_type),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- ACTIVITY LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    company_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_values_json JSON,
    new_values_json JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_company (company_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Display success message
SELECT 'Assessment Portal Database Schema Created Successfully!' AS Status;
