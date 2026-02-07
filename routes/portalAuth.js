import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {query} from '../db/database.js';
import {generateToken, authenticateToken} from '../middleware/auth.js';

const router=express.Router();

// =============================================
// REGISTER
// =============================================
router.post('/register', async (req, res) =>
{
    try
    {
        const {
            username,
            email,
            password,
            confirmPassword,
            fullName,
            phone,
            role='candidate'
        }=req.body;

        // Validation
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

        // Email validation
        const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email))
        {
            return res.status(400).json({message: 'Invalid email format'});
        }

        // Validate role
        const validRoles=['candidate', 'company_admin', 'company_hr'];
        if (!validRoles.includes(role))
        {
            return res.status(400).json({message: 'Invalid role'});
        }

        // Check if username exists
        const existingUsername=await query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existingUsername.length>0)
        {
            return res.status(400).json({message: 'Username already exists'});
        }

        // Check if email exists
        const existingEmail=await query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        if (existingEmail.length>0)
        {
            return res.status(400).json({message: 'Email already registered'});
        }

        // Hash password
        const hashedPassword=await bcrypt.hash(password, 10);

        // Insert user
        const result=await query(
            `INSERT INTO users (username, email, password, full_name, phone, role, email_verified) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, email.toLowerCase(), hashedPassword, fullName||null, phone||null, role, false]
        );

        const userId=result.insertId;

        // Get user data
        const users=await query(
            'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?',
            [userId]
        );
        const user=users[0];

        // Generate token
        const token=generateToken(user);

        console.log(`✅ User registered: ${username} (${role})`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                createdAt: user.created_at
            },
            token
        });
    } catch (error)
    {
        console.error('Registration error:', error);
        res.status(500).json({message: 'Registration failed', error: error.message});
    }
});

// =============================================
// LOGIN
// =============================================
router.post('/login', async (req, res) =>
{
    try
    {
        const {username, password}=req.body;

        if (!username||!password)
        {
            return res.status(400).json({message: 'Username and password are required'});
        }

        // Find user by username or email
        const users=await query(
            `SELECT id, username, email, password, full_name, phone, role, 
                    profile_image, is_active, email_verified, created_at 
             FROM users 
             WHERE username = ? OR email = ?`,
            [username, username.toLowerCase()]
        );

        if (users.length===0)
        {
            return res.status(401).json({message: 'Invalid username or password'});
        }

        const user=users[0];

        // Check if user is active
        if (!user.is_active)
        {
            return res.status(401).json({message: 'Account is deactivated. Please contact support.'});
        }

        // Verify password
        const isValidPassword=await bcrypt.compare(password, user.password);
        if (!isValidPassword)
        {
            return res.status(401).json({message: 'Invalid username or password'});
        }

        // Update last login
        await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        // Generate token
        const token=generateToken(user);

        console.log(`✅ User logged in: ${user.username} (${user.role})`);

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                phone: user.phone,
                role: user.role,
                profileImage: user.profile_image,
                emailVerified: user.email_verified,
                createdAt: user.created_at
            },
            token
        });
    } catch (error)
    {
        console.error('Login error:', error);
        res.status(500).json({message: 'Login failed', error: error.message});
    }
});

// =============================================
// GET CURRENT USER
// =============================================
router.get('/me', authenticateToken, async (req, res) =>
{
    try
    {
        const users=await query(
            `SELECT id, username, email, full_name, phone, role, profile_image,
                    resume_url, linkedin_url, github_url, portfolio_url,
                    current_company, current_role, experience_years,
                    skills_json, education_json, is_active, email_verified, 
                    last_login, created_at
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (users.length===0)
        {
            return res.status(404).json({message: 'User not found'});
        }

        const user=users[0];

        // Get company info if user is company role
        let company=null;
        if (['company_admin', 'company_hr'].includes(user.role))
        {
            const companies=await query(
                `SELECT c.id, c.name, c.slug, c.logo_url, cm.role as member_role
                 FROM companies c
                 JOIN company_members cm ON c.id = cm.company_id
                 WHERE cm.user_id = ? AND cm.is_active = TRUE
                 LIMIT 1`,
                [user.id]
            );
            if (companies.length>0)
            {
                company=companies[0];
            }
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            role: user.role,
            profileImage: user.profile_image,
            resumeUrl: user.resume_url,
            linkedinUrl: user.linkedin_url,
            githubUrl: user.github_url,
            portfolioUrl: user.portfolio_url,
            currentCompany: user.current_company,
            currentRole: user.current_role,
            experienceYears: user.experience_years,
            skills: user.skills_json? JSON.parse(user.skills_json):[],
            education: user.education_json? JSON.parse(user.education_json):[],
            emailVerified: user.email_verified,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            company
        });
    } catch (error)
    {
        console.error('Get user error:', error);
        res.status(500).json({message: 'Failed to get user info', error: error.message});
    }
});

// =============================================
// UPDATE PROFILE
// =============================================
router.put('/profile', authenticateToken, async (req, res) =>
{
    try
    {
        const {
            fullName,
            phone,
            profileImage,
            resumeUrl,
            linkedinUrl,
            githubUrl,
            portfolioUrl,
            currentCompany,
            currentRole,
            experienceYears,
            skills,
            education
        }=req.body;

        await query(
            `UPDATE users SET 
                full_name = COALESCE(?, full_name),
                phone = COALESCE(?, phone),
                profile_image = COALESCE(?, profile_image),
                resume_url = COALESCE(?, resume_url),
                linkedin_url = COALESCE(?, linkedin_url),
                github_url = COALESCE(?, github_url),
                portfolio_url = COALESCE(?, portfolio_url),
                current_company = COALESCE(?, current_company),
                current_role = COALESCE(?, current_role),
                experience_years = COALESCE(?, experience_years),
                skills_json = COALESCE(?, skills_json),
                education_json = COALESCE(?, education_json),
                updated_at = NOW()
             WHERE id = ?`,
            [
                fullName,
                phone,
                profileImage,
                resumeUrl,
                linkedinUrl,
                githubUrl,
                portfolioUrl,
                currentCompany,
                currentRole,
                experienceYears,
                skills? JSON.stringify(skills):null,
                education? JSON.stringify(education):null,
                req.user.id
            ]
        );

        res.json({success: true, message: 'Profile updated successfully'});
    } catch (error)
    {
        console.error('Update profile error:', error);
        res.status(500).json({message: 'Failed to update profile', error: error.message});
    }
});

// =============================================
// CHANGE PASSWORD
// =============================================
router.put('/change-password', authenticateToken, async (req, res) =>
{
    try
    {
        const {currentPassword, newPassword, confirmPassword}=req.body;

        if (!currentPassword||!newPassword)
        {
            return res.status(400).json({message: 'Current and new passwords are required'});
        }

        if (newPassword!==confirmPassword)
        {
            return res.status(400).json({message: 'New passwords do not match'});
        }

        if (newPassword.length<6)
        {
            return res.status(400).json({message: 'Password must be at least 6 characters'});
        }

        // Get user's current password
        const users=await query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        if (users.length===0)
        {
            return res.status(404).json({message: 'User not found'});
        }

        // Verify current password
        const isValid=await bcrypt.compare(currentPassword, users[0].password);
        if (!isValid)
        {
            return res.status(401).json({message: 'Current password is incorrect'});
        }

        // Hash new password
        const hashedPassword=await bcrypt.hash(newPassword, 10);

        await query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
            [hashedPassword, req.user.id]);

        res.json({success: true, message: 'Password changed successfully'});
    } catch (error)
    {
        console.error('Change password error:', error);
        res.status(500).json({message: 'Failed to change password', error: error.message});
    }
});

// =============================================
// SEND OTP
// =============================================
router.post('/send-otp', async (req, res) =>
{
    try
    {
        const {email, purpose='register'}=req.body;

        if (!email)
        {
            return res.status(400).json({message: 'Email is required'});
        }

        const emailLower=email.toLowerCase();

        // For registration, check email is not already registered
        if (purpose==='register')
        {
            const existing=await query('SELECT id FROM users WHERE email = ?', [emailLower]);
            if (existing.length>0)
            {
                return res.status(400).json({message: 'Email is already registered'});
            }
        }

        // For password reset, check email exists
        if (purpose==='forgot_password')
        {
            const existing=await query('SELECT id FROM users WHERE email = ?', [emailLower]);
            if (existing.length===0)
            {
                return res.status(404).json({message: 'No account found with this email'});
            }
        }

        // Generate OTP
        const otp=Math.floor(100000+Math.random()*900000).toString();
        const expiresAt=new Date(Date.now()+10*60*1000); // 10 minutes

        // Store OTP
        await query(
            `INSERT INTO otp_codes (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)`,
            [emailLower, otp, purpose, expiresAt]
        );

        // In production, send email here
        console.log(`📧 OTP for ${emailLower}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent successfully',
            // Only include OTP in development
            ...(process.env.NODE_ENV!=='production'&&{otp})
        });
    } catch (error)
    {
        console.error('Send OTP error:', error);
        res.status(500).json({message: 'Failed to send OTP', error: error.message});
    }
});

// =============================================
// VERIFY OTP
// =============================================
router.post('/verify-otp', async (req, res) =>
{
    try
    {
        const {email, otp, purpose='register'}=req.body;

        if (!email||!otp)
        {
            return res.status(400).json({message: 'Email and OTP are required'});
        }

        const emailLower=email.toLowerCase();

        // Find valid OTP
        const otps=await query(
            `SELECT id, expires_at FROM otp_codes 
             WHERE email = ? AND otp = ? AND purpose = ? AND used = FALSE
             ORDER BY created_at DESC LIMIT 1`,
            [emailLower, otp, purpose]
        );

        if (otps.length===0)
        {
            return res.status(400).json({message: 'Invalid OTP', verified: false});
        }

        const otpRecord=otps[0];

        // Check if expired
        if (new Date()>new Date(otpRecord.expires_at))
        {
            return res.status(400).json({message: 'OTP has expired', verified: false});
        }

        // Mark as used
        await query('UPDATE otp_codes SET used = TRUE WHERE id = ?', [otpRecord.id]);

        res.json({success: true, message: 'OTP verified', verified: true});
    } catch (error)
    {
        console.error('Verify OTP error:', error);
        res.status(500).json({message: 'Verification failed', verified: false});
    }
});

// =============================================
// FORGOT PASSWORD
// =============================================
router.post('/forgot-password', async (req, res) =>
{
    try
    {
        const {email}=req.body;

        if (!email)
        {
            return res.status(400).json({message: 'Email is required'});
        }

        const emailLower=email.toLowerCase();

        // Check if user exists
        const users=await query('SELECT id FROM users WHERE email = ?', [emailLower]);
        if (users.length===0)
        {
            return res.status(404).json({message: 'No account found with this email'});
        }

        // Generate OTP
        const otp=Math.floor(100000+Math.random()*900000).toString();
        const expiresAt=new Date(Date.now()+10*60*1000);

        await query(
            `INSERT INTO otp_codes (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)`,
            [emailLower, otp, 'forgot_password', expiresAt]
        );

        console.log(`📧 Password reset OTP for ${emailLower}: ${otp}`);

        res.json({
            success: true,
            message: 'Reset OTP sent to your email',
            ...(process.env.NODE_ENV!=='production'&&{otp})
        });
    } catch (error)
    {
        console.error('Forgot password error:', error);
        res.status(500).json({message: 'Failed to send reset code'});
    }
});

// =============================================
// RESET PASSWORD
// =============================================
router.post('/reset-password', async (req, res) =>
{
    try
    {
        const {email, password, confirmPassword}=req.body;

        if (!email||!password)
        {
            return res.status(400).json({message: 'Email and new password are required'});
        }

        if (password!==confirmPassword)
        {
            return res.status(400).json({message: 'Passwords do not match'});
        }

        if (password.length<6)
        {
            return res.status(400).json({message: 'Password must be at least 6 characters'});
        }

        const emailLower=email.toLowerCase();

        // Hash new password
        const hashedPassword=await bcrypt.hash(password, 10);

        // Update password
        const result=await query(
            'UPDATE users SET password = ?, updated_at = NOW() WHERE email = ?',
            [hashedPassword, emailLower]
        );

        if (result.affectedRows===0)
        {
            return res.status(404).json({message: 'User not found'});
        }

        console.log(`✅ Password reset for ${emailLower}`);

        res.json({success: true, message: 'Password reset successfully'});
    } catch (error)
    {
        console.error('Reset password error:', error);
        res.status(500).json({message: 'Failed to reset password'});
    }
});

// =============================================
// LOGOUT
// =============================================
router.post('/logout', (req, res) =>
{
    res.json({success: true, message: 'Logged out successfully'});
});

export default router;
