import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function createTables()
{
    console.log('Creating missing tables...');

    const conn=await mysql.createConnection({
        host: process.env.DB_HOST||'localhost',
        port: parseInt(process.env.DB_PORT||'3306'),
        user: process.env.DB_USER||'root',
        password: process.env.DB_PASSWORD||'',
        database: process.env.DB_NAME||'interview_platform_db',
        multipleStatements: true
    });

    try
    {
        // Create contests table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS contests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
                INDEX idx_public (is_public)
            );
        `);
        console.log('✅ Contests table created');

        // Create contest_registrations table
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
            );
        `);
        console.log('✅ Contest registrations table created');

        // Create contest_submissions table
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
                INDEX idx_score (score DESC)
            );
        `);
        console.log('✅ Contest submissions table created');

        // Create user_skills table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_skills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                skill_name VARCHAR(100) NOT NULL,
                skill_category ENUM('programming', 'framework', 'database', 'cloud', 'devops', 'soft_skills', 'domain', 'other') DEFAULT 'programming',
                proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
                years_experience INT DEFAULT 0,
                verified BOOLEAN DEFAULT FALSE,
                verified_through VARCHAR(100),
                score DECIMAL(5,2) DEFAULT 0,
                last_assessed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_skill (user_id, skill_name),
                INDEX idx_user (user_id),
                INDEX idx_skill_name (skill_name)
            );
        `);
        console.log('✅ User skills table created');

        // Create user_scores table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_scores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                activity_type ENUM('coding_practice', 'ai_interview', 'live_interview', 'assessment', 'contest', 'challenge') NOT NULL,
                activity_id INT NULL,
                score DECIMAL(8,2) NOT NULL,
                max_score DECIMAL(8,2) DEFAULT 100,
                activity_title VARCHAR(255),
                difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
                duration_seconds INT,
                problems_solved INT DEFAULT 0,
                total_problems INT DEFAULT 0,
                skills_assessed JSON,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_activity_type (activity_type),
                INDEX idx_completed (completed_at)
            );
        `);
        console.log('✅ User scores table created');

        // Create user_leaderboard_stats table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_leaderboard_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                total_score DECIMAL(12,2) DEFAULT 0,
                total_activities INT DEFAULT 0,
                average_score DECIMAL(5,2) DEFAULT 0,
                coding_score DECIMAL(10,2) DEFAULT 0,
                coding_problems_solved INT DEFAULT 0,
                interview_score DECIMAL(10,2) DEFAULT 0,
                interview_count INT DEFAULT 0,
                contest_score DECIMAL(10,2) DEFAULT 0,
                contest_count INT DEFAULT 0,
                challenge_score DECIMAL(10,2) DEFAULT 0,
                challenge_count INT DEFAULT 0,
                global_rank INT DEFAULT 0,
                weekly_rank INT DEFAULT 0,
                monthly_rank INT DEFAULT 0,
                current_streak_days INT DEFAULT 0,
                longest_streak_days INT DEFAULT 0,
                last_activity_date DATE,
                badges JSON,
                achievements JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_total_score (total_score DESC),
                INDEX idx_global_rank (global_rank)
            );
        `);
        console.log('✅ User leaderboard stats table created');

        console.log('\n✅ All missing tables created successfully!');

    } catch (error)
    {
        console.error('Error:', error.message);
    } finally
    {
        await conn.end();
    }
}

createTables();
