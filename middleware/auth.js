import jwt from 'jsonwebtoken';
import {query} from '../db/database.js';

// Use the same secret as Python backend for JWT verification
const JWT_SECRET=process.env.JWT_SECRET_KEY||process.env.JWT_SECRET||'your-secret-key-change-in-production';

// Verify JWT token middleware
export function authenticateToken(req, res, next)
{
    const authHeader=req.headers['authorization'];
    const token=authHeader&&authHeader.split(' ')[1];

    if (!token)
    {
        return res.status(401).json({message: 'Access token required'});
    }

    try
    {
        const decoded=jwt.verify(token, JWT_SECRET);
        req.user=decoded;
        next();
    } catch (error)
    {
        return res.status(403).json({message: 'Invalid or expired token'});
    }
}

// Generate JWT token
export function generateToken(user)
{
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            companyId: user.companyId||null
        },
        JWT_SECRET,
        {expiresIn: '24h'}
    );
}

// Role-based authorization middleware
export function authorize(...allowedRoles)
{
    return (req, res, next) =>
    {
        if (!req.user)
        {
            return res.status(401).json({message: 'Not authenticated'});
        }

        if (!allowedRoles.includes(req.user.role))
        {
            return res.status(403).json({message: 'Insufficient permissions'});
        }

        next();
    };
}

// Check if user belongs to company
export async function authorizeCompanyAccess(req, res, next)
{
    if (!req.user)
    {
        return res.status(401).json({message: 'Not authenticated'});
    }

    const companyId=req.params.companyId||req.body.companyId;

    if (!companyId)
    {
        return next();
    }

    try
    {
        // Check if user is a member of this company
        const members=await query(
            'SELECT * FROM company_members WHERE company_id = ? AND user_id = ?',
            [companyId, req.user.id]
        );

        if (members.length===0&&req.user.role!=='admin')
        {
            return res.status(403).json({message: 'Not authorized for this company'});
        }

        req.companyMember=members[0];
        next();
    } catch (error)
    {
        console.error('Company authorization error:', error);
        res.status(500).json({message: 'Authorization failed'});
    }
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(req, res, next)
{
    const authHeader=req.headers['authorization'];
    const token=authHeader&&authHeader.split(' ')[1];

    if (token)
    {
        try
        {
            const decoded=jwt.verify(token, JWT_SECRET);
            req.user=decoded;
        } catch (error)
        {
            // Token invalid, but continue without user
        }
    }

    next();
}

export {JWT_SECRET};
