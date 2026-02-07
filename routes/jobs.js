/**
 * Jobs Routes for Candidates
 * Browse upcoming jobs, match based on skills and scores, and apply
 */

import express from 'express';
import {query} from '../db/database.js';

const router=express.Router();

/**
 * Get all available jobs with skill matching
 * GET /api/jobs
 * Query params: skills (comma-separated), experience, location, job_type, page, limit
 */
router.get('/', async (req, res) =>
{
    try
    {
        const {
            skills,
            experience,
            location,
            job_type,
            company_id,
            search,
            page=1,
            limit=20,
            sort='newest' // newest, salary_high, match_score
        }=req.query;

        const offset=(page-1)*limit;

        let sql=`
            SELECT 
                j.*,
                c.name as company_name,
                c.logo_url as company_logo,
                c.industry,
                c.company_size,
                c.headquarters as company_location,
                (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count
            FROM jobs j
            LEFT JOIN companies c ON j.company_id = c.id
            WHERE j.status = 'published'
        `;
        let params=[];

        // Filter by company
        if (company_id)
        {
            sql+=' AND j.company_id = ?';
            params.push(company_id);
        }

        // Filter by job type
        if (job_type)
        {
            sql+=' AND j.job_type = ?';
            params.push(job_type);
        }

        // Filter by location
        if (location)
        {
            sql+=' AND (j.location LIKE ? OR j.is_remote = TRUE)';
            params.push(`%${location}%`);
        }

        // Filter by minimum experience
        if (experience)
        {
            sql+=' AND j.min_experience_years <= ?';
            params.push(parseInt(experience));
        }

        // Search in title and description
        if (search)
        {
            sql+=' AND (j.title LIKE ? OR j.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Sort order
        switch (sort)
        {
            case 'salary_high':
                sql+=' ORDER BY j.salary_max DESC';
                break;
            case 'oldest':
                sql+=' ORDER BY j.published_at ASC';
                break;
            case 'newest':
            default:
                sql+=' ORDER BY j.published_at DESC';
        }

        sql+=' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const jobs=await query(sql, params);

        // Get total count for pagination
        let countSql=`
            SELECT COUNT(*) as total 
            FROM jobs j 
            WHERE j.status = 'published'
        `;
        let countParams=[];

        if (company_id)
        {
            countSql+=' AND j.company_id = ?';
            countParams.push(company_id);
        }
        if (job_type)
        {
            countSql+=' AND j.job_type = ?';
            countParams.push(job_type);
        }
        if (location)
        {
            countSql+=' AND (j.location LIKE ? OR j.is_remote = TRUE)';
            countParams.push(`%${location}%`);
        }
        if (experience)
        {
            countSql+=' AND j.min_experience_years <= ?';
            countParams.push(parseInt(experience));
        }
        if (search)
        {
            countSql+=' AND (j.title LIKE ? OR j.description LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [countResult]=await query(countSql, countParams);
        const total=countResult?.total||0;

        // Parse JSON fields
        const parsedJobs=jobs.map(job => ({
            ...job,
            skills_required: job.skills_required_json? JSON.parse(job.skills_required_json):[],
            skills_preferred: job.skills_preferred_json? JSON.parse(job.skills_preferred_json):[],
            benefits: job.benefits_json? JSON.parse(job.benefits_json):[],
            assessment_modules: job.assessment_modules_json? JSON.parse(job.assessment_modules_json):[]
        }));

        res.json({
            success: true,
            jobs: parsedJobs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total/limit)
            }
        });
    } catch (error)
    {
        console.error('Get jobs error:', error);
        res.status(500).json({message: 'Failed to fetch jobs', error: error.message});
    }
});

/**
 * Get job details by ID
 * GET /api/jobs/:jobId
 */
router.get('/:jobId', async (req, res) =>
{
    try
    {
        const {jobId}=req.params;

        const [job]=await query(`
            SELECT 
                j.*,
                c.name as company_name,
                c.logo_url as company_logo,
                c.description as company_description,
                c.industry,
                c.company_size,
                c.headquarters as company_location,
                c.website as company_website,
                c.linkedin_url as company_linkedin,
                (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count
            FROM jobs j
            LEFT JOIN companies c ON j.company_id = c.id
            WHERE j.id = ?
        `, [jobId]);

        if (!job)
        {
            return res.status(404).json({message: 'Job not found'});
        }

        // Get skill requirements for this job
        const skills=await query(`
            SELECT skill_name, is_required, min_proficiency, weight
            FROM job_skill_requirements
            WHERE job_id = ?
        `, [jobId]);

        const parsedJob={
            ...job,
            skills_required: job.skills_required_json? JSON.parse(job.skills_required_json):[],
            skills_preferred: job.skills_preferred_json? JSON.parse(job.skills_preferred_json):[],
            benefits: job.benefits_json? JSON.parse(job.benefits_json):[],
            assessment_modules: job.assessment_modules_json? JSON.parse(job.assessment_modules_json):[],
            skill_requirements: skills
        };

        res.json({success: true, job: parsedJob});
    } catch (error)
    {
        console.error('Get job details error:', error);
        res.status(500).json({message: 'Failed to fetch job', error: error.message});
    }
});

/**
 * Get jobs matched to user's skills and scores
 * GET /api/jobs/match/:userId
 */
router.get('/match/:userId', async (req, res) =>
{
    try
    {
        const {userId}=req.params;
        const {page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        // Get user's skills
        const userSkills=await query(`
            SELECT skill_name, proficiency_level, score
            FROM user_skills
            WHERE user_id = ?
        `, [userId]);

        // Get user's leaderboard stats
        const [userStats]=await query(`
            SELECT * FROM user_leaderboard_stats WHERE user_id = ?
        `, [userId]);

        // Get user's profile for experience
        const [user]=await query(`
            SELECT experience_years, skills_json FROM users WHERE id = ?
        `, [userId]);

        const skillNames=userSkills.map(s => s.skill_name.toLowerCase());
        const userProfileSkills=user?.skills_json? JSON.parse(user.skills_json):[];

        // Get all published jobs
        const jobs=await query(`
            SELECT 
                j.*,
                c.name as company_name,
                c.logo_url as company_logo,
                c.industry,
                c.company_size
            FROM jobs j
            LEFT JOIN companies c ON j.company_id = c.id
            WHERE j.status = 'published'
            ORDER BY j.published_at DESC
        `);

        // Calculate match score for each job
        const matchedJobs=jobs.map(job =>
        {
            let skillMatchScore=0;
            let totalWeight=0;

            const requiredSkills=job.skills_required_json? JSON.parse(job.skills_required_json):[];
            const preferredSkills=job.skills_preferred_json? JSON.parse(job.skills_preferred_json):[];

            // Check required skills (weight: 1.0)
            requiredSkills.forEach(skill =>
            {
                const skillLower=skill.toLowerCase();
                totalWeight+=1.0;
                if (skillNames.includes(skillLower)||userProfileSkills.some(s => s.toLowerCase().includes(skillLower)))
                {
                    skillMatchScore+=1.0;
                }
            });

            // Check preferred skills (weight: 0.5)
            preferredSkills.forEach(skill =>
            {
                const skillLower=skill.toLowerCase();
                totalWeight+=0.5;
                if (skillNames.includes(skillLower)||userProfileSkills.some(s => s.toLowerCase().includes(skillLower)))
                {
                    skillMatchScore+=0.5;
                }
            });

            // Calculate skill match percentage
            const skillMatchPercentage=totalWeight>0? (skillMatchScore/totalWeight)*100:50;

            // Platform score bonus (based on coding, interview scores)
            const platformScore=userStats?
                Math.min(100, (userStats.average_score||0)*1.0):0;

            // Experience match
            let experienceMatch=100;
            if (user?.experience_years!==undefined&&job.min_experience_years)
            {
                if (user.experience_years>=job.min_experience_years)
                {
                    experienceMatch=100;
                } else
                {
                    experienceMatch=Math.max(0, 100-((job.min_experience_years-user.experience_years)*20));
                }
            }

            // Overall match score: 60% skills, 25% platform performance, 15% experience
            const overallMatch=(skillMatchPercentage*0.6)+(platformScore*0.25)+(experienceMatch*0.15);

            return {
                ...job,
                skills_required: requiredSkills,
                skills_preferred: preferredSkills,
                benefits: job.benefits_json? JSON.parse(job.benefits_json):[],
                match_score: Math.round(overallMatch*10)/10,
                skill_match: Math.round(skillMatchPercentage*10)/10,
                platform_score: Math.round(platformScore*10)/10,
                experience_match: Math.round(experienceMatch*10)/10
            };
        });

        // Sort by match score
        matchedJobs.sort((a, b) => b.match_score-a.match_score);

        // Paginate
        const paginatedJobs=matchedJobs.slice(offset, offset+parseInt(limit));

        res.json({
            success: true,
            jobs: paginatedJobs,
            user_stats: userStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: matchedJobs.length,
                totalPages: Math.ceil(matchedJobs.length/limit)
            }
        });
    } catch (error)
    {
        console.error('Match jobs error:', error);
        res.status(500).json({message: 'Failed to match jobs', error: error.message});
    }
});

/**
 * Apply to a job
 * POST /api/jobs/:jobId/apply
 */
router.post('/:jobId/apply', async (req, res) =>
{
    try
    {
        const {jobId}=req.params;
        const {
            userId,
            cover_letter,
            resume_version
        }=req.body;

        if (!userId)
        {
            return res.status(400).json({message: 'User ID is required'});
        }

        // Check if job exists and is open
        const [job]=await query('SELECT * FROM jobs WHERE id = ? AND status = "published"', [jobId]);
        if (!job)
        {
            return res.status(404).json({message: 'Job not found or not accepting applications'});
        }

        // Check if already applied
        const [existingApp]=await query(
            'SELECT * FROM applications WHERE candidate_user_id = ? AND job_id = ?',
            [userId, jobId]
        );
        if (existingApp)
        {
            return res.status(400).json({message: 'You have already applied to this job'});
        }

        // Get user's skill match score
        const userSkills=await query('SELECT skill_name FROM user_skills WHERE user_id = ?', [userId]);
        const [userStats]=await query('SELECT * FROM user_leaderboard_stats WHERE user_id = ?', [userId]);

        const requiredSkills=job.skills_required_json? JSON.parse(job.skills_required_json):[];
        const skillNames=userSkills.map(s => s.skill_name.toLowerCase());

        let skillMatch=0;
        if (requiredSkills.length>0)
        {
            const matchedSkills=requiredSkills.filter(s => skillNames.includes(s.toLowerCase()));
            skillMatch=(matchedSkills.length/requiredSkills.length)*100;
        } else
        {
            skillMatch=50; // Default if no skills required
        }

        const platformScore=userStats?.average_score||0;
        const overallMatch=Math.round((skillMatch*0.6+platformScore*0.4)*10)/10;

        // Create application
        const result=await query(`
            INSERT INTO applications 
            (candidate_user_id, job_id, cover_letter, resume_version, skill_match_score, platform_score, overall_match_score, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'applied')
        `, [userId, jobId, cover_letter, resume_version, skillMatch, platformScore, overallMatch]);

        res.json({
            success: true,
            message: 'Application submitted successfully',
            application_id: result.insertId,
            match_scores: {
                skill_match: skillMatch,
                platform_score: platformScore,
                overall_match: overallMatch
            }
        });
    } catch (error)
    {
        console.error('Apply to job error:', error);
        res.status(500).json({message: 'Failed to submit application', error: error.message});
    }
});

/**
 * Get user's applications
 * GET /api/jobs/applications/:userId
 */
router.get('/applications/:userId', async (req, res) =>
{
    try
    {
        const {userId}=req.params;
        const {status, page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT 
                a.*,
                j.title as job_title,
                j.location,
                j.job_type,
                j.salary_min,
                j.salary_max,
                c.name as company_name,
                c.logo_url as company_logo
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            LEFT JOIN companies c ON j.company_id = c.id
            WHERE a.candidate_user_id = ?
        `;
        let params=[userId];

        if (status)
        {
            sql+=' AND a.status = ?';
            params.push(status);
        }

        sql+=' ORDER BY a.applied_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const applications=await query(sql, params);

        // Get total count
        let countSql='SELECT COUNT(*) as total FROM applications WHERE candidate_user_id = ?';
        let countParams=[userId];
        if (status)
        {
            countSql+=' AND status = ?';
            countParams.push(status);
        }
        const [countResult]=await query(countSql, countParams);

        res.json({
            success: true,
            applications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult?.total||0,
                totalPages: Math.ceil((countResult?.total||0)/limit)
            }
        });
    } catch (error)
    {
        console.error('Get applications error:', error);
        res.status(500).json({message: 'Failed to fetch applications', error: error.message});
    }
});

/**
 * Withdraw application
 * DELETE /api/jobs/applications/:applicationId
 */
router.delete('/applications/:applicationId', async (req, res) =>
{
    try
    {
        const {applicationId}=req.params;
        const {userId}=req.body;

        const [app]=await query(
            'SELECT * FROM applications WHERE id = ? AND candidate_user_id = ?',
            [applicationId, userId]
        );

        if (!app)
        {
            return res.status(404).json({message: 'Application not found'});
        }

        if (['accepted', 'offer_extended', 'offer_accepted'].includes(app.status))
        {
            return res.status(400).json({message: 'Cannot withdraw this application at current stage'});
        }

        await query(
            'UPDATE applications SET status = "withdrawn", updated_at = NOW() WHERE id = ?',
            [applicationId]
        );

        res.json({success: true, message: 'Application withdrawn successfully'});
    } catch (error)
    {
        console.error('Withdraw application error:', error);
        res.status(500).json({message: 'Failed to withdraw application', error: error.message});
    }
});

export default router;
