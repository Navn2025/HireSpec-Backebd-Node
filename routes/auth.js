import express from 'express';
import crypto from 'crypto';
import {query, getDatabase} from '../db/database.js';

const router=express.Router();

// In-memory OTP storage (could be moved to Redis in production)
const otpCodes=new Map();

// Active tokens storage (userId -> token)
const activeTokens=new Map();

// Helper to generate token
function generateToken()
{
    return crypto.randomBytes(32).toString('hex');
}

// Helper to hash password
function hashPassword(password)
{
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Check if database is available
function isDatabaseAvailable()
{
    return getDatabase()!==null;
}

// Register
router.post('/register', async (req, res) =>
{
    try
    {
        const {username, email, password, confirmPassword, role='candidate'}=req.body;

        if (!username||!email||!password)
        {
            return res.status(400).json({message: 'Username, email and password are required'});
        }

        if (password!==confirmPassword)
        {
            return res.status(400).json({message: 'Passwords do not match'});
        }

        if (username.length<3)
        {
            return res.status(400).json({message: 'Username must be at least 3 characters'});
        }

        if (password.length<6)
        {
            return res.status(400).json({message: 'Password must be at least 6 characters'});
        }

        // Validate role
        const validRoles=['candidate', 'company_admin', 'company_hr', 'admin'];
        const userRole=validRoles.includes(role)? role:'candidate';

        const hashedPassword=hashPassword(password);

        if (isDatabaseAvailable())
        {
            // Check if user exists in database
            const existingUser=await query(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email]
            );

            if (existingUser.length>0)
            {
                return res.status(400).json({message: 'Username or email already exists'});
            }

            // Insert user into database
            const result=await query(
                `INSERT INTO users (username, email, password, role, is_active, created_at) 
                 VALUES (?, ?, ?, ?, true, NOW())`,
                [username, email, hashedPassword, userRole]
            );

            const userId=result.insertId;

            console.log(`✅ User registered in DB: ${username} (${userRole}) - ID: ${userId}`);

            res.json({
                success: true,
                message: 'Registration successful',
                user: {
                    id: userId,
                    username,
                    email,
                    role: userRole
                }
            });
        }
        else
        {
            // Fallback to error - database required for proper storage
            console.error('❌ Database not available for registration');
            res.status(503).json({message: 'Database not available. Please try again later.'});
        }
    } catch (error)
    {
        console.error('Registration error:', error);
        if (error.code==='ER_DUP_ENTRY')
        {
            res.status(400).json({message: 'Username or email already exists'});
        } else
        {
            res.status(500).json({message: 'Registration failed'});
        }
    }
});

// Login
router.post('/login', async (req, res) =>
{
    try
    {
        const {username, password}=req.body;

        if (!username||!password)
        {
            return res.status(400).json({message: 'Username and password are required'});
        }

        // Find user by username
        let foundUser=null;
        for (const [, user] of users)
        {
            if (user.username===username||user.email===username)
            {
                foundUser=user;
                break;
            }
        }

        if (!foundUser)
        {
            return res.status(401).json({message: 'Invalid username or password'});
        }

        const hashedPassword=hashPassword(password);
        if (foundUser.password!==hashedPassword)
        {
            return res.status(401).json({message: 'Invalid username or password'});
        }

        const token=generateToken();

        console.log(`✅ User logged in: ${username}`);

        res.json({
            success: true,
            message: 'Login successful',
            id: foundUser.id,
            username: foundUser.username,
            email: foundUser.email,
            role: foundUser.role,
            token
        });
    } catch (error)
    {
        console.error('Login error:', error);
        res.status(500).json({message: 'Login failed'});
    }
});

// Face login (simplified - just returns error for now)
router.post('/face-login', async (req, res) =>
{
    res.status(501).json({message: 'Face login not implemented in this backend. Please use password login.'});
});

// Get current user
router.get('/me', async (req, res) =>
{
    const token=req.headers.authorization?.replace('Bearer ', '');

    if (!token)
    {
        return res.status(401).json({message: 'Not authenticated'});
    }

    // In production, verify token and get user from database
    // For now, return null to trigger re-login
    res.status(401).json({message: 'Session expired'});
});

// Logout
router.post('/logout', async (req, res) =>
{
    res.json({success: true, message: 'Logged out successfully'});
});

// Send OTP
router.post('/send-otp', async (req, res) =>
{
    try
    {
        const {email, purpose='register'}=req.body;

        if (!email)
        {
            return res.status(400).json({message: 'Email is required'});
        }

        const otp=Math.floor(100000+Math.random()*900000).toString();
        const expiresAt=Date.now()+10*60*1000; // 10 minutes

        otpCodes.set(email, {otp, purpose, expiresAt});

        console.log(`📧 OTP for ${email}: ${otp} (would be sent via email in production)`);

        res.json({
            success: true,
            message: 'OTP sent successfully (check console in dev mode)'
        });
    } catch (error)
    {
        console.error('Send OTP error:', error);
        res.status(500).json({message: 'Failed to send OTP'});
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) =>
{
    try
    {
        const {email, otp, purpose='register'}=req.body;

        if (!email||!otp)
        {
            return res.status(400).json({message: 'Email and OTP are required'});
        }

        const stored=otpCodes.get(email);

        if (!stored)
        {
            return res.status(400).json({message: 'No OTP found for this email'});
        }

        if (stored.otp!==otp)
        {
            return res.status(400).json({message: 'Invalid OTP'});
        }

        if (Date.now()>stored.expiresAt)
        {
            otpCodes.delete(email);
            return res.status(400).json({message: 'OTP has expired'});
        }

        if (stored.purpose!==purpose)
        {
            return res.status(400).json({message: 'OTP purpose mismatch'});
        }

        otpCodes.delete(email);

        res.json({
            success: true,
            message: 'OTP verified successfully'
        });
    } catch (error)
    {
        console.error('Verify OTP error:', error);
        res.status(500).json({message: 'Failed to verify OTP'});
    }
});

// Forgot password
router.post('/forgot-password', async (req, res) =>
{
    try
    {
        const {email}=req.body;

        if (!email)
        {
            return res.status(400).json({message: 'Email is required'});
        }

        // Find user by email
        let foundUser=null;
        for (const [, user] of users)
        {
            if (user.email===email)
            {
                foundUser=user;
                break;
            }
        }

        if (!foundUser)
        {
            // Don't reveal if email exists
            return res.json({
                success: true,
                message: 'If an account exists with this email, a reset link has been sent'
            });
        }

        const otp=Math.floor(100000+Math.random()*900000).toString();
        const expiresAt=Date.now()+10*60*1000;

        otpCodes.set(email, {otp, purpose: 'reset', expiresAt});

        console.log(`🔑 Password reset OTP for ${email}: ${otp}`);

        res.json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent'
        });
    } catch (error)
    {
        console.error('Forgot password error:', error);
        res.status(500).json({message: 'Failed to process request'});
    }
});

// Reset password
router.post('/reset-password', async (req, res) =>
{
    try
    {
        const {email, password, confirmPassword}=req.body;

        if (!email||!password)
        {
            return res.status(400).json({message: 'Email and password are required'});
        }

        if (password!==confirmPassword)
        {
            return res.status(400).json({message: 'Passwords do not match'});
        }

        if (password.length<6)
        {
            return res.status(400).json({message: 'Password must be at least 6 characters'});
        }

        // Find and update user
        for (const [userId, user] of users)
        {
            if (user.email===email)
            {
                user.password=hashPassword(password);
                users.set(userId, user);
                console.log(`✅ Password reset for: ${email}`);
                return res.json({
                    success: true,
                    message: 'Password reset successfully'
                });
            }
        }

        res.status(400).json({message: 'User not found'});
    } catch (error)
    {
        console.error('Reset password error:', error);
        res.status(500).json({message: 'Failed to reset password'});
    }
});

export default router;
