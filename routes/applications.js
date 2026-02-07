/**
 * Applications Routes
 * Candidate job application management
 */

import express from 'express';
import {query, db} from '../db/database.js';
import {calculateATSScore} from '../services/resumeParser.js';

const router=express.Router();

/**
 * Apply for a job
 * POST /api/applications
 */
router.post('/', async (req, res) =>
{
    try
    {
        const {candidate_user_id, job_id, cover_letter}=req.body;

        if (!candidate_user_id||!job_id)
        {
            return res.status(400).json({message: 'User ID and Job ID are required'});
        }

        // Check if already applied
        const existing=await query(
            'SELECT id FROM applications WHERE candidate_user_id = ? AND job_id = ?',
            [candidate_user_id, job_id]
        );

        if (existing.length>0)
        {
            return res.status(400).json({message: 'You have already applied for this job'});
        }

        // Check if job exists and is open
        const [job]=await query(
            'SELECT * FROM jobs WHERE id = ? AND status = "open"',
            [job_id]
        );

        if (!job.length)
        {
            return res.status(404).json({message: 'Job not found or no longer accepting applications'});
        }

        // Get user's resume for ATS scoring
        const [resume]=await query(
            'SELECT parsed_data_json FROM candidate_resumes WHERE user_id = ?',
            [candidate_user_id]
        );

        // Create application
        const result=await query(
            `INSERT INTO applications (candidate_user_id, job_id, status, cover_letter)
             VALUES (?, ?, 'applied', ?)`,
            [candidate_user_id, job_id, cover_letter]
        );

        const applicationId=result.insertId;

        // Calculate and store ATS score if resume exists
        if (resume.length&&resume[0].parsed_data_json)
        {
            const parsedResume=JSON.parse(resume[0].parsed_data_json);
            const jobSkills=job[0].skills_json? JSON.parse(job[0].skills_json):{};

            const jobRequirements={
                required_skills: jobSkills.required||[],
                preferred_skills: jobSkills.preferred||[],
                min_experience_years: job[0].experience_required||0,
                required_education: job[0].requirements||'',
                keywords: jobSkills.keywords||[],
                title: job[0].title,
                description: job[0].description
            };

            const atsResult=calculateATSScore(parsedResume, jobRequirements);

            // Store ATS score
            await query(
                `INSERT INTO ats_scores 
                 (user_id, job_id, overall_score, breakdown_json, 
                  matched_skills_json, missing_skills_json, recommendations_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    overall_score = VALUES(overall_score),
                    breakdown_json = VALUES(breakdown_json),
                    calculated_at = NOW()`,
                [
                    candidate_user_id,
                    job_id,
                    atsResult.overall_score,
                    JSON.stringify(atsResult.breakdown),
                    JSON.stringify(atsResult.matched_skills),
                    JSON.stringify(atsResult.missing_skills),
                    JSON.stringify(atsResult.recommendations)
                ]
            );
        }

        // Create notification for company HR
        const [jobWithCompany]=await query(
            `SELECT j.title, j.created_by_user_id, c.name as company_name
             FROM jobs j
             LEFT JOIN companies c ON j.company_id = c.id
             WHERE j.id = ?`,
            [job_id]
        );

        if (jobWithCompany.length&&jobWithCompany[0].created_by_user_id)
        {
            await db.createNotification(
                jobWithCompany[0].created_by_user_id,
                'application_update',
                'New Application Received',
                `New application received for ${jobWithCompany[0].title}`,
                `/hiring/jobs/${job_id}/applications`
            );
        }

        res.json({
            success: true,
            message: 'Application submitted successfully',
            application_id: applicationId
        });
    } catch (error)
    {
        console.error('Apply error:', error);
        res.status(500).json({message: 'Failed to submit application', error: error.message});
    }
});

/**
 * Get user's applications
 * GET /api/applications/user/:user_id
 */
router.get('/user/:user_id', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;
        const {status, page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT app.*, 
                   j.title as job_title, j.location, j.job_type, j.description as job_description,
                   c.name as company_name, c.logo_url as company_logo,
                   ats.overall_score as ats_score, ats.breakdown_json as ats_breakdown
            FROM applications app
            JOIN jobs j ON app.job_id = j.id
            LEFT JOIN companies c ON j.company_id = c.id
            LEFT JOIN ats_scores ats ON app.candidate_user_id = ats.user_id AND app.job_id = ats.job_id
            WHERE app.candidate_user_id = ?
        `;
        let params=[user_id];

        if (status)
        {
            sql+=' AND app.status = ?';
            params.push(status);
        }

        sql+=' ORDER BY app.applied_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const applications=await query(sql, params);

        // Get total count
        const [countResult]=await query(
            'SELECT COUNT(*) as total FROM applications WHERE candidate_user_id = ?',
            [user_id]
        );

        res.json({
            applications: applications.map(app => ({
                ...app,
                ats_breakdown: app.ats_breakdown? JSON.parse(app.ats_breakdown):null
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total
            }
        });
    } catch (error)
    {
        console.error('Get applications error:', error);
        res.status(500).json({message: 'Failed to get applications', error: error.message});
    }
});

/**
 * Get application details
 * GET /api/applications/:id
 */
router.get('/:id', async (req, res) =>
{
    try
    {
        const {id}=req.params;

        const [application]=await query(
            `SELECT app.*, 
                    u.username, u.email, u.phone, u.linkedin_url, u.github_url,
                    j.title as job_title, j.description as job_description, 
                    j.requirements, j.location, j.job_type, j.skills_json,
                    c.name as company_name, c.logo_url as company_logo,
                    ats.overall_score as ats_score, ats.breakdown_json,
                    ats.matched_skills_json, ats.missing_skills_json, ats.recommendations_json,
                    cr.parsed_data_json as resume_data
             FROM applications app
             JOIN users u ON app.candidate_user_id = u.id
             JOIN jobs j ON app.job_id = j.id
             LEFT JOIN companies c ON j.company_id = c.id
             LEFT JOIN ats_scores ats ON app.candidate_user_id = ats.user_id AND app.job_id = ats.job_id
             LEFT JOIN candidate_resumes cr ON app.candidate_user_id = cr.user_id
             WHERE app.id = ?`,
            [id]
        );

        if (!application.length)
        {
            return res.status(404).json({message: 'Application not found'});
        }

        const app=application[0];

        // Get related assessments
        const assessments=await query(
            `SELECT * FROM assessments 
             WHERE candidate_user_id = ? AND job_id = ?
             ORDER BY created_at DESC`,
            [app.candidate_user_id, app.job_id]
        );

        // Get related interviews
        const interviews=await query(
            `SELECT i.* 
             FROM interviews i
             JOIN assessments a ON i.assessment_id = a.id
             WHERE a.candidate_user_id = ? AND a.job_id = ?
             ORDER BY i.scheduled_at DESC`,
            [app.candidate_user_id, app.job_id]
        );

        res.json({
            application: {
                ...app,
                skills_required: app.skills_json? JSON.parse(app.skills_json):{},
                ats_breakdown: app.breakdown_json? JSON.parse(app.breakdown_json):null,
                matched_skills: app.matched_skills_json? JSON.parse(app.matched_skills_json):[],
                missing_skills: app.missing_skills_json? JSON.parse(app.missing_skills_json):[],
                recommendations: app.recommendations_json? JSON.parse(app.recommendations_json):[],
                resume: app.resume_data? JSON.parse(app.resume_data):null
            },
            assessments,
            interviews
        });
    } catch (error)
    {
        console.error('Get application error:', error);
        res.status(500).json({message: 'Failed to get application', error: error.message});
    }
});

/**
 * Withdraw application
 * PUT /api/applications/:id/withdraw
 */
router.put('/:id/withdraw', async (req, res) =>
{
    try
    {
        const {id}=req.params;

        const result=await query(
            `UPDATE applications SET status = 'withdrawn', updated_at = NOW()
             WHERE id = ? AND status NOT IN ('accepted', 'rejected')`,
            [id]
        );

        if (result.affectedRows===0)
        {
            return res.status(400).json({message: 'Cannot withdraw this application'});
        }

        res.json({success: true, message: 'Application withdrawn successfully'});
    } catch (error)
    {
        console.error('Withdraw error:', error);
        res.status(500).json({message: 'Failed to withdraw application', error: error.message});
    }
});

/**
 * Get available jobs for candidate
 * GET /api/applications/jobs/available
 */
router.get('/jobs/available', async (req, res) =>
{
    try
    {
        const {
            user_id,
            search,
            industry,
            job_type,
            location,
            min_salary,
            max_experience,
            page=1,
            limit=20
        }=req.query;

        const offset=(page-1)*limit;

        let sql=`
            SELECT j.*, 
                   c.name as company_name, c.logo_url as company_logo, c.industry,
                   (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as total_applications
        `;

        // Add subquery to check if user has already applied
        if (user_id)
        {
            sql+=`,
                   (SELECT 1 FROM applications WHERE job_id = j.id AND candidate_user_id = ? LIMIT 1) as has_applied`;
        }

        sql+=`
            FROM jobs j
            LEFT JOIN companies c ON j.company_id = c.id
            WHERE j.status = 'open'
        `;

        let params=user_id? [user_id]:[];

        if (search)
        {
            sql+=' AND (j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (industry)
        {
            sql+=' AND c.industry = ?';
            params.push(industry);
        }

        if (job_type)
        {
            sql+=' AND j.job_type = ?';
            params.push(job_type);
        }

        if (location)
        {
            sql+=' AND j.location LIKE ?';
            params.push(`%${location}%`);
        }

        if (min_salary)
        {
            sql+=' AND j.salary_min >= ?';
            params.push(min_salary);
        }

        if (max_experience)
        {
            sql+=' AND j.experience_required <= ?';
            params.push(max_experience);
        }

        sql+=' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const jobs=await query(sql, params);

        res.json({
            jobs: jobs.map(j => ({
                ...j,
                skills: j.skills_json? JSON.parse(j.skills_json):{},
                has_applied: !!j.has_applied
            }))
        });
    } catch (error)
    {
        console.error('Get jobs error:', error);
        res.status(500).json({message: 'Failed to get jobs', error: error.message});
    }
});

/**
 * Get recommended jobs based on user profile
 * GET /api/applications/jobs/recommended/:user_id
 */
router.get('/jobs/recommended/:user_id', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;
        const {limit=10}=req.query;

        // Get user's skills and experience
        const [user]=await query(
            `SELECT u.skills, u.experience_years, cr.extracted_skills_json
             FROM users u
             LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
             WHERE u.id = ?`,
            [user_id]
        );

        if (!user.length)
        {
            return res.status(404).json({message: 'User not found'});
        }

        const userSkills=[
            ...(user[0].skills? JSON.parse(user[0].skills):[]),
            ...(user[0].extracted_skills_json? JSON.parse(user[0].extracted_skills_json):[])
        ];

        // Find jobs matching user's skills
        const jobs=await query(
            `SELECT j.*, 
                    c.name as company_name, c.logo_url as company_logo,
                    (SELECT 1 FROM applications WHERE job_id = j.id AND candidate_user_id = ? LIMIT 1) as has_applied
             FROM jobs j
             LEFT JOIN companies c ON j.company_id = c.id
             WHERE j.status = 'open'
             AND j.experience_required <= COALESCE(?, 0) + 2
             ORDER BY j.created_at DESC
             LIMIT ?`,
            [user_id, user[0].experience_years, parseInt(limit)]
        );

        // Score and sort by match
        const scoredJobs=jobs.map(job =>
        {
            const jobSkills=job.skills_json? JSON.parse(job.skills_json):{};
            const requiredSkills=jobSkills.required||[];

            let matchScore=0;
            requiredSkills.forEach(skill =>
            {
                if (userSkills.some(us =>
                    us.toLowerCase().includes(skill.toLowerCase())||
                    skill.toLowerCase().includes(us.toLowerCase())
                ))
                {
                    matchScore+=10;
                }
            });

            return {...job, match_score: matchScore, has_applied: !!job.has_applied};
        });

        scoredJobs.sort((a, b) => b.match_score-a.match_score);

        res.json({
            recommended_jobs: scoredJobs.map(j => ({
                ...j,
                skills: j.skills_json? JSON.parse(j.skills_json):{}
            }))
        });
    } catch (error)
    {
        console.error('Get recommended jobs error:', error);
        res.status(500).json({message: 'Failed to get recommendations', error: error.message});
    }
});

export default router;
