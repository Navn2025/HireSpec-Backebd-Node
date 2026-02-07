import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration()
{
    const conn=await mysql.createConnection({
        host: process.env.DB_HOST||'localhost',
        port: parseInt(process.env.DB_PORT||'3306'),
        user: process.env.DB_USER||'root',
        password: process.env.DB_PASSWORD||'',
        database: process.env.DB_NAME||'interview_platform_db',
        multipleStatements: true
    });

    console.log('Connected to database');

    // Create users table
    await conn.query(`
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Users table created');

    // Create companies table
    await conn.query(`
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
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Companies table created');

    // Create contests table
    await conn.query(`
        CREATE TABLE IF NOT EXISTS contests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            duration_minutes INT DEFAULT 120,
            contest_type ENUM('coding', 'quiz', 'mixed') DEFAULT 'coding',
            difficulty ENUM('Easy', 'Medium', 'Hard', 'Mixed') DEFAULT 'Mixed',
            max_participants INT DEFAULT NULL,
            is_public BOOLEAN DEFAULT TRUE,
            requires_registration BOOLEAN DEFAULT TRUE,
            scoring_type ENUM('standard', 'time_based', 'penalty_based') DEFAULT 'standard',
            problems_json JSON,
            prizes_json JSON,
            status ENUM('upcoming', 'active', 'ended', 'cancelled') DEFAULT 'upcoming',
            created_by_user_id INT,
            company_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_start_time (start_time),
            INDEX idx_status (status),
            INDEX idx_public (is_public),
            INDEX idx_created_by (created_by_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Contests table created');

    // Create contest registrations table
    await conn.query(`
        CREATE TABLE IF NOT EXISTS contest_registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            contest_id INT NOT NULL,
            user_id INT NOT NULL,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('registered', 'participated', 'disqualified', 'no_show') DEFAULT 'registered',
            UNIQUE KEY uq_contest_user (contest_id, user_id),
            INDEX idx_contest (contest_id),
            INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Contest registrations table created');

    // Create contest submissions table
    await conn.query(`
        CREATE TABLE IF NOT EXISTS contest_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            contest_id INT NOT NULL,
            user_id INT NOT NULL,
            problem_id INT,
            code TEXT,
            language VARCHAR(50),
            score DECIMAL(8,2) DEFAULT 0,
            time_taken_seconds INT,
            test_cases_passed INT DEFAULT 0,
            test_cases_total INT DEFAULT 0,
            status ENUM('pending', 'accepted', 'wrong_answer', 'time_limit', 'runtime_error', 'compilation_error') DEFAULT 'pending',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_contest (contest_id),
            INDEX idx_user (user_id),
            INDEX idx_problem (problem_id),
            INDEX idx_score (score)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Contest submissions table created');

    await conn.end();
    console.log('✅ Migration complete!');
}

runMigration().catch(err =>
{
    console.error('Migration failed:', err);
    process.exit(1);
});
