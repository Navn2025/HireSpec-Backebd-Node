/**
 * Company Management Routes
 * CRUD operations for companies and company members
 */

import express from 'express';
import {query, transaction} from '../db/database.js';

const router=express.Router();

/**
 * Create a new company
 * POST /api/companies
 */
router.post('/', async (req, res) =>
{
    try
    {
        const {
            name,
            description,
            website,
            logo_url,
            industry,
            size,
            location,
            admin_user_id
        }=req.body;

        if (!name)
        {
            return res.status(400).json({message: 'Company name is required'});
        }

        // Check if company exists
        const existing=await query('SELECT id FROM companies WHERE name = ?', [name]);
        if (existing.length>0)
        {
            return res.status(400).json({message: 'Company name already exists'});
        }

        await transaction(async (conn) =>
        {
            // Create company
            const [result]=await conn.execute(
                `INSERT INTO companies (name, description, website, logo_url, industry, size, location)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, description, website, logo_url, industry, size, location]
            );

            const companyId=result.insertId;

            // Add admin as member
            if (admin_user_id)
            {
                await conn.execute(
                    `INSERT INTO company_members (company_id, user_id, role)
                     VALUES (?, ?, 'admin')`,
                    [companyId, admin_user_id]
                );

                // Update user role
                await conn.execute(
                    `UPDATE users SET role = 'company_admin' WHERE id = ?`,
                    [admin_user_id]
                );
            }

            res.json({
                success: true,
                message: 'Company created successfully',
                company_id: companyId
            });
        });
    } catch (error)
    {
        console.error('Create company error:', error);
        res.status(500).json({message: 'Failed to create company', error: error.message});
    }
});

/**
 * Get company by ID
 * GET /api/companies/:id
 */
router.get('/:id', async (req, res) =>
{
    try
    {
        const {id}=req.params;

        const companies=await query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM jobs WHERE company_id = c.id) as total_jobs,
                    (SELECT COUNT(*) FROM jobs WHERE company_id = c.id AND status = 'open') as open_jobs,
                    (SELECT COUNT(*) FROM company_members WHERE company_id = c.id) as total_members
             FROM companies c
             WHERE c.id = ?`,
            [id]
        );

        if (companies.length===0)
        {
            return res.status(404).json({message: 'Company not found'});
        }

        // Get company members
        const members=await query(
            `SELECT cm.*, u.username, u.email, u.profile_picture
             FROM company_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.company_id = ?`,
            [id]
        );

        res.json({
            company: companies[0],
            members
        });
    } catch (error)
    {
        console.error('Get company error:', error);
        res.status(500).json({message: 'Failed to get company', error: error.message});
    }
});

/**
 * Update company
 * PUT /api/companies/:id
 */
router.put('/:id', async (req, res) =>
{
    try
    {
        const {id}=req.params;
        const updates=req.body;

        const allowedFields=['name', 'description', 'website', 'logo_url', 'industry', 'size', 'location'];
        const setClauses=[];
        const params=[];

        allowedFields.forEach(field =>
        {
            if (updates[field]!==undefined)
            {
                setClauses.push(`${field} = ?`);
                params.push(updates[field]);
            }
        });

        if (setClauses.length===0)
        {
            return res.status(400).json({message: 'No updates provided'});
        }

        params.push(id);
        await query(
            `UPDATE companies SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );

        res.json({success: true, message: 'Company updated successfully'});
    } catch (error)
    {
        console.error('Update company error:', error);
        res.status(500).json({message: 'Failed to update company', error: error.message});
    }
});

/**
 * Get all companies
 * GET /api/companies
 */
router.get('/', async (req, res) =>
{
    try
    {
        const {industry, size, search, page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT c.*,
                   (SELECT COUNT(*) FROM jobs WHERE company_id = c.id AND status = 'open') as open_jobs
            FROM companies c
            WHERE 1=1
        `;
        let params=[];

        if (industry)
        {
            sql+=' AND c.industry = ?';
            params.push(industry);
        }

        if (size)
        {
            sql+=' AND c.size = ?';
            params.push(size);
        }

        if (search)
        {
            sql+=' AND (c.name LIKE ? OR c.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql+=' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const companies=await query(sql, params);
        res.json({companies});
    } catch (error)
    {
        console.error('Get companies error:', error);
        res.status(500).json({message: 'Failed to get companies', error: error.message});
    }
});

/**
 * Add member to company
 * POST /api/companies/:id/members
 */
router.post('/:id/members', async (req, res) =>
{
    try
    {
        const {id}=req.params;
        const {user_id, role='interviewer'}=req.body;

        if (!user_id)
        {
            return res.status(400).json({message: 'User ID is required'});
        }

        const validRoles=['admin', 'hr', 'interviewer'];
        if (!validRoles.includes(role))
        {
            return res.status(400).json({message: 'Invalid role'});
        }

        // Check if already a member
        const existing=await query(
            'SELECT id FROM company_members WHERE company_id = ? AND user_id = ?',
            [id, user_id]
        );

        if (existing.length>0)
        {
            return res.status(400).json({message: 'User is already a member of this company'});
        }

        await query(
            `INSERT INTO company_members (company_id, user_id, role)
             VALUES (?, ?, ?)`,
            [id, user_id, role]
        );

        // Update user role if necessary
        const roleMapping={
            'admin': 'company_admin',
            'hr': 'company_hr',
            'interviewer': 'interviewer'
        };

        await query(
            'UPDATE users SET role = ? WHERE id = ?',
            [roleMapping[role], user_id]
        );

        res.json({success: true, message: 'Member added successfully'});
    } catch (error)
    {
        console.error('Add member error:', error);
        res.status(500).json({message: 'Failed to add member', error: error.message});
    }
});

/**
 * Remove member from company
 * DELETE /api/companies/:id/members/:user_id
 */
router.delete('/:id/members/:user_id', async (req, res) =>
{
    try
    {
        const {id, user_id}=req.params;

        await query(
            'DELETE FROM company_members WHERE company_id = ? AND user_id = ?',
            [id, user_id]
        );

        res.json({success: true, message: 'Member removed successfully'});
    } catch (error)
    {
        console.error('Remove member error:', error);
        res.status(500).json({message: 'Failed to remove member', error: error.message});
    }
});

/**
 * Get company dashboard stats
 * GET /api/companies/:id/dashboard
 */
router.get('/:id/dashboard', async (req, res) =>
{
    try
    {
        const {id}=req.params;

        // Get basic stats
        const [company]=await query('SELECT * FROM companies WHERE id = ?', [id]);
        if (!company.length)
        {
            return res.status(404).json({message: 'Company not found'});
        }

        // Jobs stats
        const [jobStats]=await query(
            `SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_jobs,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_jobs
             FROM jobs WHERE company_id = ?`,
            [id]
        );

        // Applications stats
        const [appStats]=await query(
            `SELECT 
                COUNT(DISTINCT app.id) as total_applications,
                COUNT(DISTINCT CASE WHEN app.status = 'applied' THEN app.id END) as new_applications,
                COUNT(DISTINCT CASE WHEN app.status = 'screening' THEN app.id END) as in_screening,
                COUNT(DISTINCT CASE WHEN app.status = 'interview_scheduled' THEN app.id END) as in_interview,
                COUNT(DISTINCT CASE WHEN app.status = 'accepted' THEN app.id END) as accepted,
                COUNT(DISTINCT CASE WHEN app.status = 'rejected' THEN app.id END) as rejected
             FROM applications app
             JOIN jobs j ON app.job_id = j.id
             WHERE j.company_id = ?`,
            [id]
        );

        // Recent applications
        const recentApplications=await query(
            `SELECT app.*, u.username, u.email, j.title as job_title,
                    ats.overall_score as ats_score
             FROM applications app
             JOIN users u ON app.candidate_user_id = u.id
             JOIN jobs j ON app.job_id = j.id
             LEFT JOIN ats_scores ats ON u.id = ats.user_id AND j.id = ats.job_id
             WHERE j.company_id = ?
             ORDER BY app.applied_at DESC
             LIMIT 10`,
            [id]
        );

        // Top candidates (highest ATS scores)
        const topCandidates=await query(
            `SELECT u.id, u.username, u.email, u.experience_years,
                    MAX(ats.overall_score) as highest_ats_score,
                    COUNT(DISTINCT app.id) as applications_count
             FROM ats_scores ats
             JOIN users u ON ats.user_id = u.id
             JOIN jobs j ON ats.job_id = j.id
             JOIN applications app ON u.id = app.candidate_user_id AND j.id = app.job_id
             WHERE j.company_id = ?
             GROUP BY u.id
             ORDER BY highest_ats_score DESC
             LIMIT 5`,
            [id]
        );

        // Skill demand analysis
        const skillDemand=await query(
            `SELECT skill, COUNT(*) as demand_count
             FROM (
                SELECT JSON_UNQUOTE(JSON_EXTRACT(j.skills_json, CONCAT('$.required[', n.n, ']'))) as skill
                FROM jobs j
                CROSS JOIN (
                    SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                ) n
                WHERE j.company_id = ?
                AND JSON_UNQUOTE(JSON_EXTRACT(j.skills_json, CONCAT('$.required[', n.n, ']'))) IS NOT NULL
             ) skills
             GROUP BY skill
             ORDER BY demand_count DESC
             LIMIT 10`,
            [id]
        );

        res.json({
            company: company[0],
            stats: {
                jobs: jobStats[0]||{total_jobs: 0, open_jobs: 0, closed_jobs: 0},
                applications: appStats[0]||{total_applications: 0}
            },
            recent_applications: recentApplications,
            top_candidates: topCandidates,
            skill_demand: skillDemand
        });
    } catch (error)
    {
        console.error('Get dashboard error:', error);
        res.status(500).json({message: 'Failed to get dashboard', error: error.message});
    }
});

/**
 * Get companies for a user
 * GET /api/companies/user/:user_id
 */
router.get('/user/:user_id', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;

        const companies=await query(
            `SELECT c.*, cm.role as member_role
             FROM companies c
             JOIN company_members cm ON c.id = cm.company_id
             WHERE cm.user_id = ?`,
            [user_id]
        );

        res.json({companies});
    } catch (error)
    {
        console.error('Get user companies error:', error);
        res.status(500).json({message: 'Failed to get companies', error: error.message});
    }
});

export default router;
