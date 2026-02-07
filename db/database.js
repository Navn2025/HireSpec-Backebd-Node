import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database connection pool configuration
const dbConfig={
    host: process.env.DB_HOST||'localhost',
    port: parseInt(process.env.DB_PORT||'3306'),
    user: process.env.DB_USER||'root',
    password: process.env.DB_PASSWORD||'',
    database: process.env.DB_NAME||'interview_platform_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

let pool=null;

// Initialize database connection pool
export async function initializeDatabase()
{
    try
    {
        pool=mysql.createPool(dbConfig);

        // Test the connection
        const connection=await pool.getConnection();
        console.log('✅ MySQL database connected successfully');
        connection.release();

        return pool;
    } catch (error)
    {
        console.error('❌ MySQL connection error:', error.message);
        console.warn('   Make sure MySQL is running and credentials are correct');
        console.warn('   The application will continue with in-memory storage for now');
        return null;
    }
}

// Get database connection pool
export function getDatabase()
{
    if (!pool)
    {
        console.warn('⚠️  Database not initialized. Using in-memory storage.');
    }
    return pool;
}

// Execute a query
export async function query(sql, params=[])
{
    try
    {
        const db=getDatabase();
        if (!db)
        {
            throw new Error('Database not available');
        }

        const [results]=await db.execute(sql, params);
        return results;
    } catch (error)
    {
        console.error('Database query error:', error.message);
        throw error;
    }
}

// Execute a transaction
export async function transaction(callback)
{
    const db=getDatabase();
    if (!db)
    {
        throw new Error('Database not available');
    }

    const connection=await db.getConnection();

    try
    {
        await connection.beginTransaction();
        const result=await callback(connection);
        await connection.commit();
        return result;
    } catch (error)
    {
        await connection.rollback();
        throw error;
    } finally
    {
        connection.release();
    }
}

// Close database connection
export async function closeDatabase()
{
    if (pool)
    {
        await pool.end();
        console.log('📊 Database connection closed');
    }
}

// Helper functions for common operations
export const db={
    // Users
    async findUserByEmail(email)
    {
        const results=await query(
            'SELECT * FROM users WHERE email = ? LIMIT 1',
            [email]
        );
        return results[0]||null;
    },

    async findUserById(id)
    {
        const results=await query(
            'SELECT * FROM users WHERE id = ? LIMIT 1',
            [id]
        );
        return results[0]||null;
    },

    async createUser(userData)
    {
        const {username, email, password, role='candidate'}=userData;
        const result=await query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, password, role]
        );
        return result.insertId;
    },

    // Assessments
    async createAssessment(data)
    {
        const {job_id, candidate_user_id, assessment_type, duration_minutes=60}=data;
        const result=await query(
            'INSERT INTO assessments (job_id, candidate_user_id, assessment_type, duration_minutes) VALUES (?, ?, ?, ?)',
            [job_id, candidate_user_id, assessment_type, duration_minutes]
        );
        return result.insertId;
    },

    async updateAssessmentStatus(id, status)
    {
        await query(
            'UPDATE assessments SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );
    },

    // Interviews
    async createInterview(data)
    {
        const {assessment_id, interview_type, room_id, candidate_user_id, interviewer_user_id}=data;
        const result=await query(
            'INSERT INTO interviews (assessment_id, interview_type, room_id, candidate_user_id, interviewer_user_id) VALUES (?, ?, ?, ?, ?)',
            [assessment_id, interview_type, room_id, candidate_user_id, interviewer_user_id]
        );
        return result.insertId;
    },

    async findInterviewByRoomId(room_id)
    {
        const results=await query(
            'SELECT * FROM interviews WHERE room_id = ? LIMIT 1',
            [room_id]
        );
        return results[0]||null;
    },

    // Coding Sessions
    async createCodingSession(user_id, session_type, assessment_id=null)
    {
        const result=await query(
            'INSERT INTO coding_sessions (user_id, session_type, assessment_id) VALUES (?, ?, ?)',
            [user_id, session_type, assessment_id]
        );
        return result.insertId;
    },

    async endCodingSession(session_id, duration_seconds)
    {
        await query(
            'UPDATE coding_sessions SET ended_at = NOW(), duration_seconds = ?, status = "completed" WHERE id = ?',
            [duration_seconds, session_id]
        );
    },

    // Proctor Logs
    async addProctorLog(data)
    {
        const {user_id, assessment_id, interview_id, session_id, type, severity='low', message, payload_json}=data;
        const result=await query(
            'INSERT INTO proctor_logs (user_id, assessment_id, interview_id, session_id, type, severity, message, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, assessment_id, interview_id, session_id, type, severity, message, JSON.stringify(payload_json)]
        );
        return result.insertId;
    },

    // Axiom Chat
    async createChat(user_id, title='New Chat')
    {
        const result=await query(
            'INSERT INTO axiom_chats (user_id, title) VALUES (?, ?)',
            [user_id, title]
        );
        return result.insertId;
    },

    async getChatsByUserId(user_id)
    {
        return await query(
            'SELECT * FROM axiom_chats WHERE user_id = ? ORDER BY last_activity DESC',
            [user_id]
        );
    },

    async addMessage(chat_id, role, content, metadata=null)
    {
        const result=await query(
            'INSERT INTO axiom_messages (chat_id, role, content, metadata_json) VALUES (?, ?, ?, ?)',
            [chat_id, role, content, metadata? JSON.stringify(metadata):null]
        );

        // Update chat last_activity
        await query(
            'UPDATE axiom_chats SET last_activity = NOW() WHERE id = ?',
            [chat_id]
        );

        return result.insertId;
    },

    async getMessagesByChatId(chat_id)
    {
        return await query(
            'SELECT * FROM axiom_messages WHERE chat_id = ? ORDER BY timestamp ASC',
            [chat_id]
        );
    },

    // Notifications
    async createNotification(user_id, type, title, message, link=null)
    {
        const result=await query(
            'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [user_id, type, title, message, link]
        );
        return result.insertId;
    },

    async getUserNotifications(user_id, limit=50)
    {
        return await query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [user_id, limit]
        );
    },

    async markNotificationRead(id)
    {
        await query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ?',
            [id]
        );
    },

    // Activity Logs
    async logActivity(user_id, action, entity_type=null, entity_id=null, description=null, ip=null, user_agent=null)
    {
        const result=await query(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, action, entity_type, entity_id, description, ip, user_agent]
        );
        return result.insertId;
    }
};

export default {
    initializeDatabase,
    getDatabase,
    query,
    transaction,
    closeDatabase,
    db
};
