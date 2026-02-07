import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true // Required for running multiple SQL statements
};

const DATABASE_NAME = process.env.DB_NAME || 'interview_platform_db';

// Migration files in order of execution
const MIGRATION_FILES = [
    // Base schema first
    { name: 'Base Schema', path: path.join(__dirname, 'schema.sql') },
    // Additional migrations from database folder
    { name: 'Unified Schema', path: path.join(__dirname, '../../database/unified-schema.sql') },
    { name: 'ATS Migration', path: path.join(__dirname, '../../database/ats_migration.sql') },
    { name: 'Challenges Migration', path: path.join(__dirname, '../../database/challenges-migration.sql') },
    { name: 'Scores & Leaderboard', path: path.join(__dirname, '../../database/scores-leaderboard-migration.sql') }
];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Preprocess SQL to handle MySQL-specific syntax issues
function preprocessSQL(sql, databaseName) {
    // Replace USE statements with the correct database name
    sql = sql.replace(/USE\s+\w+;/gi, `USE ${databaseName};`);
    
    // Remove CREATE DATABASE IF NOT EXISTS statements (we handle this separately)
    sql = sql.replace(/CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+\w+;/gi, '');
    
    // Handle ADD COLUMN IF NOT EXISTS (not supported in older MySQL versions)
    // Convert to a safer format by removing IF NOT EXISTS for ADD COLUMN
    sql = sql.replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN');
    
    // Handle ADD INDEX IF NOT EXISTS
    sql = sql.replace(/ADD\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'ADD INDEX');
    
    // Handle ADD CONSTRAINT IF NOT EXISTS  
    sql = sql.replace(/ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS/gi, 'ADD CONSTRAINT');
    
    // Handle CREATE INDEX IF NOT EXISTS
    sql = sql.replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX');
    
    return sql;
}

// Split SQL into individual statements, handling edge cases
function splitSQLStatements(sql) {
    const statements = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let inComment = false;
    let inMultiComment = false;
    
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1] || '';
        
        // Handle multi-line comments
        if (!inString && char === '/' && nextChar === '*') {
            inMultiComment = true;
            current += char;
            continue;
        }
        if (inMultiComment && char === '*' && nextChar === '/') {
            inMultiComment = false;
            current += char + nextChar;
            i++;
            continue;
        }
        if (inMultiComment) {
            current += char;
            continue;
        }
        
        // Handle single-line comments
        if (!inString && char === '-' && nextChar === '-') {
            inComment = true;
        }
        if (inComment && char === '\n') {
            inComment = false;
        }
        if (inComment) {
            current += char;
            continue;
        }
        
        // Handle strings
        if ((char === "'" || char === '"') && sql[i - 1] !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
        
        // Handle statement terminator
        if (char === ';' && !inString && !inComment && !inMultiComment) {
            current += char;
            const statement = current.trim();
            if (statement && !statement.startsWith('--')) {
                statements.push(statement);
            }
            current = '';
            continue;
        }
        
        current += char;
    }
    
    // Handle any remaining content
    const remaining = current.trim();
    if (remaining && !remaining.startsWith('--') && remaining.length > 5) {
        statements.push(remaining);
    }
    
    return statements;
}

// Execute a single SQL statement with error handling
async function executeStatement(connection, statement, ignoreErrors = false) {
    // Skip empty statements or comments
    if (!statement || statement.startsWith('--') || statement.match(/^\s*$/)) {
        return true;
    }
    
    try {
        await connection.query(statement);
        return true;
    } catch (error) {
        // Ignore duplicate column/key errors for idempotent migrations
        const ignorableErrors = [
            'ER_DUP_FIELDNAME',      // Duplicate column
            'ER_DUP_KEYNAME',        // Duplicate key
            'ER_TABLE_EXISTS_ERROR', // Table already exists (for non-IF NOT EXISTS)
            'ER_CANT_DROP_FIELD_OR_KEY', // Can't drop key that doesn't exist
            'ER_FK_DUP_NAME'         // Duplicate foreign key name
        ];
        
        if (ignoreErrors || ignorableErrors.includes(error.code)) {
            // Silently ignore or log a warning
            return true;
        }
        
        throw error;
    }
}

// Run a single migration file
async function runMigration(connection, migration) {
    log(`\n📦 Running: ${migration.name}`, 'cyan');
    
    // Check if file exists
    if (!fs.existsSync(migration.path)) {
        log(`   ⚠️  File not found: ${migration.path}`, 'yellow');
        return { success: true, skipped: true };
    }
    
    try {
        // Read SQL file
        let sql = fs.readFileSync(migration.path, 'utf8');
        
        // Preprocess SQL
        sql = preprocessSQL(sql, DATABASE_NAME);
        
        // Split into statements
        const statements = splitSQLStatements(sql);
        log(`   Found ${statements.length} SQL statements`, 'blue');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            // Skip SELECT statements (usually just for output messages)
            if (statement.trim().toUpperCase().startsWith('SELECT')) {
                continue;
            }
            
            try {
                await executeStatement(connection, statement, true);
                successCount++;
            } catch (error) {
                errorCount++;
                // Log extracted statement summary and error
                const preview = statement.substring(0, 80).replace(/\n/g, ' ');
                log(`   ❌ Error in statement: ${preview}...`, 'red');
                log(`      ${error.message}`, 'red');
            }
        }
        
        log(`   ✅ Completed: ${successCount} statements executed, ${errorCount} errors`, 'green');
        return { success: true, statements: successCount, errors: errorCount };
        
    } catch (error) {
        log(`   ❌ Failed to read/parse file: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

// Main migration function
async function runMigrations() {
    let connection;
    
    log('\n🚀 Starting Database Migration', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    try {
        // Connect without database first to create it
        log('\n📡 Connecting to MySQL server...', 'blue');
        connection = await mysql.createConnection(dbConfig);
        log('   ✅ Connected to MySQL server', 'green');
        
        // Create database if not exists
        log(`\n📁 Creating database: ${DATABASE_NAME}`, 'blue');
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${DATABASE_NAME}`);
        await connection.query(`USE ${DATABASE_NAME}`);
        log(`   ✅ Database ready: ${DATABASE_NAME}`, 'green');
        
        // Create migrations tracking table
        log('\n📋 Setting up migration tracking...', 'blue');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        log('   ✅ Migration tracking table ready', 'green');
        
        // Run each migration
        const results = [];
        for (const migration of MIGRATION_FILES) {
            // Check if already executed (optional - for re-runnable migrations we skip this)
            // const [rows] = await connection.query(
            //     'SELECT id FROM _migrations WHERE name = ?',
            //     [migration.name]
            // );
            // if (rows.length > 0) {
            //     log(`\n⏭️  Skipping: ${migration.name} (already executed)`, 'yellow');
            //     continue;
            // }
            
            const result = await runMigration(connection, migration);
            results.push({ ...migration, ...result });
            
            // Record successful migration
            if (result.success && !result.skipped) {
                try {
                    await connection.query(
                        'INSERT INTO _migrations (name) VALUES (?) ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP',
                        [migration.name]
                    );
                } catch (e) {
                    // Ignore tracking errors
                }
            }
        }
        
        // Print summary
        log('\n' + '=' .repeat(50), 'cyan');
        log('📊 Migration Summary', 'cyan');
        log('=' .repeat(50), 'cyan');
        
        for (const result of results) {
            if (result.skipped) {
                log(`   ⏭️  ${result.name}: Skipped (file not found)`, 'yellow');
            } else if (result.success) {
                log(`   ✅ ${result.name}: ${result.statements} statements, ${result.errors} errors`, 'green');
            } else {
                log(`   ❌ ${result.name}: Failed - ${result.error}`, 'red');
            }
        }
        
        log('\n✅ Database migration completed!', 'green');
        log(`   Database: ${DATABASE_NAME}`, 'blue');
        log(`   Host: ${dbConfig.host}:${dbConfig.port}`, 'blue');
        
    } catch (error) {
        log(`\n❌ Migration failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            log('\n📡 Database connection closed', 'blue');
        }
    }
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Migration Tool
=======================

Usage: node migrate.js [options]

Options:
  --help, -h     Show this help message
  --fresh        Drop and recreate all tables (DESTRUCTIVE!)

Environment Variables:
  DB_HOST        MySQL host (default: localhost)
  DB_PORT        MySQL port (default: 3306)
  DB_USER        MySQL user (default: root)
  DB_PASSWORD    MySQL password (default: '')
  DB_NAME        Database name (default: interview_platform_db)
`);
    process.exit(0);
}

if (args.includes('--fresh')) {
    log('\n⚠️  WARNING: --fresh will DROP all tables!', 'red');
    log('   This is a destructive operation.', 'red');
    log('   Press Ctrl+C within 5 seconds to cancel...', 'yellow');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    log('\n🗑️  Dropping existing tables...', 'yellow');
    // Fresh migration logic - drop database and recreate
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`DROP DATABASE IF EXISTS ${DATABASE_NAME}`);
    await connection.end();
    log('   ✅ Database dropped', 'green');
}

// Run migrations
runMigrations();
