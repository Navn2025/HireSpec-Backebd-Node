/**
 * Hiring Routes
 * Company HR dashboard endpoints for candidate management
 */

import express from 'express';
import {query, transaction} from '../db/database.js';
import {filterCandidates, getTopCandidates, compareCandidates, getCandidatesByTier, searchCandidates} from '../services/candidateFilter.js';
import {calculateATSScore, rankCandidates} from '../services/resumeParser.js';
import {storeAssessmentResult, storeCandidateReport, getCandidateResults, getApplicationResults} from '../services/resultsStorage.js';

const router=express.Router();

// ==================== JOB MANAGEMENT ====================

/**
 * Create a new job posting
 * POST /api/hiring/jobs
 */
router.post('/jobs', async (req, res) =>
{
    try
    {
        const {
            company_id,
            created_by_user_id,
            title,
            description,
            requirements,
            location,
            job_type,
            experience_required,
            salary_min,
            salary_max,
            currency,
            skills,
            modules,
            deadline
        }=req.body;

        if (!title)
        {
            return res.status(400).json({message: 'Job title is required'});
        }

        const result=await query(
            `INSERT INTO jobs 
             (company_id, created_by_user_id, title, description, requirements,
              location, job_type, experience_required, salary_min, salary_max,
              currency, skills_json, modules_json, status, deadline)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
            [
                company_id,
                created_by_user_id,
                title,
                description,
                requirements,
                location,
                job_type||'full-time',
                experience_required||0,
                salary_min,
                salary_max,
                currency||'USD',
                JSON.stringify(skills||{}),
                JSON.stringify(modules||[]),
                deadline
            ]
        );

        res.json({
            success: true,
            message: 'Job created successfully',
            job_id: result.insertId
        });
    } catch (error)
    {
        console.error('Create job error:', error);
        res.status(500).json({message: 'Failed to create job', error: error.message});
    }
});

/**
 * Get all jobs for a company
 * GET /api/hiring/jobs?company_id=X
 */
router.get('/jobs', async (req, res) =>
{
    try
    {
        const {company_id, status, page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT j.*, 
                   c.name as company_name,
                   u.username as created_by_username,
                   (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as application_count
            FROM jobs j
            LEFT JOIN companies c ON j.company_id = c.id
            LEFT JOIN users u ON j.created_by_user_id = u.id
            WHERE 1=1
        `;
        let params=[];

        if (company_id)
        {
            sql+=' AND j.company_id = ?';
            params.push(company_id);
        }

        if (status)
        {
            sql+=' AND j.status = ?';
            params.push(status);
        }

        sql+=' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const jobs=await query(sql, params);

        // Parse JSON fields
        const parsedJobs=jobs.map(job => ({
            ...job,
            skills: job.skills_json? JSON.parse(job.skills_json):{},
            modules: job.modules_json? JSON.parse(job.modules_json):[]
        }));

        res.json({jobs: parsedJobs});
    } catch (error)
    {
        console.error('Get jobs error:', error);
        res.status(500).json({message: 'Failed to fetch jobs', error: error.message});
    }
});

/**
 * Update job posting
 * PUT /api/hiring/jobs/:job_id
 */
router.put('/jobs/:job_id', async (req, res) =>
{
    try
    {
        const {job_id}=req.params;
        const updates=req.body;

        const allowedFields=[
            'title', 'description', 'requirements', 'location', 'job_type',
            'experience_required', 'salary_min', 'salary_max', 'currency',
            'status', 'deadline'
        ];

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

        if (updates.skills)
        {
            setClauses.push('skills_json = ?');
            params.push(JSON.stringify(updates.skills));
        }

        if (updates.modules)
        {
            setClauses.push('modules_json = ?');
            params.push(JSON.stringify(updates.modules));
        }

        if (setClauses.length===0)
        {
            return res.status(400).json({message: 'No updates provided'});
        }

        params.push(job_id);
        await query(
            `UPDATE jobs SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );

        res.json({success: true, message: 'Job updated successfully'});
    } catch (error)
    {
        console.error('Update job error:', error);
        res.status(500).json({message: 'Failed to update job', error: error.message});
    }
});

// ==================== APPLICATION MANAGEMENT ====================

/**
 * Get all applications for a job
 * GET /api/hiring/jobs/:job_id/applications
 */
router.get('/jobs/:job_id/applications', async (req, res) =>
{
    try
    {
        const {job_id}=req.params;
        const {status, sort_by='ats_score', page=1, limit=20}=req.query;

        const filters={
            job_id,
            status,
            sort_by,
            page: parseInt(page),
            limit: parseInt(limit)
        };

        const result=await filterCandidates(filters);
        res.json(result);
    } catch (error)
    {
        console.error('Get applications error:', error);
        res.status(500).json({message: 'Failed to fetch applications', error: error.message});
    }
});

/**
 * Update application status
 * PUT /api/hiring/applications/:application_id
 */
router.put('/applications/:application_id', async (req, res) =>
{
    try
    {
        const {application_id}=req.params;
        const {status, notes}=req.body;

        const validStatuses=['applied', 'screening', 'interview_scheduled', 'rejected', 'accepted', 'withdrawn'];
        if (status&&!validStatuses.includes(status))
        {
            return res.status(400).json({message: 'Invalid status'});
        }

        await query(
            `UPDATE applications 
             SET status = COALESCE(?, status), 
                 updated_at = NOW() 
             WHERE id = ?`,
            [status, application_id]
        );

        // Get application details for notification
        const [app]=await query(
            `SELECT candidate_user_id, job_id FROM applications WHERE id = ?`,
            [application_id]
        );

        if (app.length&&status)
        {
            const [job]=await query('SELECT title FROM jobs WHERE id = ?', [app[0].job_id]);

            await query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES (?, 'application_update', 'Application Status Updated', ?, ?)`,
                [
                    app[0].candidate_user_id,
                    `Your application for ${job[0]?.title||'the position'} has been updated to: ${status}`,
                    `/applications/${application_id}`
                ]
            );
        }

        res.json({success: true, message: 'Application updated successfully'});
    } catch (error)
    {
        console.error('Update application error:', error);
        res.status(500).json({message: 'Failed to update application', error: error.message});
    }
});

/**
 * Bulk update application statuses
 * POST /api/hiring/applications/bulk-update
 */
router.post('/applications/bulk-update', async (req, res) =>
{
    try
    {
        const {application_ids, status}=req.body;

        if (!application_ids?.length||!status)
        {
            return res.status(400).json({message: 'Application IDs and status are required'});
        }

        const placeholders=application_ids.map(() => '?').join(',');
        await query(
            `UPDATE applications SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
            [status, ...application_ids]
        );

        res.json({
            success: true,
            message: `${application_ids.length} applications updated to ${status}`
        });
    } catch (error)
    {
        console.error('Bulk update error:', error);
        res.status(500).json({message: 'Failed to bulk update', error: error.message});
    }
});

// ==================== CANDIDATE FILTERING ====================

/**
 * Filter candidates with advanced criteria
 * POST /api/hiring/candidates/filter
 */
router.post('/candidates/filter', async (req, res) =>
{
    try
    {
        const result=await filterCandidates(req.body);
        res.json(result);
    } catch (error)
    {
        console.error('Filter candidates error:', error);
        res.status(500).json({message: 'Failed to filter candidates', error: error.message});
    }
});

/**
 * Get top candidates for a job
 * GET /api/hiring/jobs/:job_id/top-candidates
 */
router.get('/jobs/:job_id/top-candidates', async (req, res) =>
{
    try
    {
        const {job_id}=req.params;
        const {limit=10}=req.query;

        const result=await getTopCandidates(job_id, parseInt(limit));
        res.json(result);
    } catch (error)
    {
        console.error('Get top candidates error:', error);
        res.status(500).json({message: 'Failed to get top candidates', error: error.message});
    }
});

/**
 * Compare multiple candidates
 * POST /api/hiring/candidates/compare
 */
router.post('/candidates/compare', async (req, res) =>
{
    try
    {
        const {candidate_ids, job_id}=req.body;

        if (!candidate_ids?.length||!job_id)
        {
            return res.status(400).json({message: 'Candidate IDs and Job ID are required'});
        }

        const result=await compareCandidates(candidate_ids, job_id);
        res.json(result);
    } catch (error)
    {
        console.error('Compare candidates error:', error);
        res.status(500).json({message: 'Failed to compare candidates', error: error.message});
    }
});

/**
 * Get candidates grouped by ATS score tiers
 * GET /api/hiring/jobs/:job_id/candidate-tiers
 */
router.get('/jobs/:job_id/candidate-tiers', async (req, res) =>
{
    try
    {
        const {job_id}=req.params;
        const result=await getCandidatesByTier(job_id);
        res.json(result);
    } catch (error)
    {
        console.error('Get candidate tiers error:', error);
        res.status(500).json({message: 'Failed to get candidate tiers', error: error.message});
    }
});

/**
 * Search candidates globally
 * GET /api/hiring/candidates/search?q=term
 */
router.get('/candidates/search', async (req, res) =>
{
    try
    {
        const {q, limit=20}=req.query;

        if (!q)
        {
            return res.status(400).json({message: 'Search query is required'});
        }

        const candidates=await searchCandidates(q, {limit: parseInt(limit)});
        res.json({candidates});
    } catch (error)
    {
        console.error('Search candidates error:', error);
        res.status(500).json({message: 'Failed to search candidates', error: error.message});
    }
});

// ==================== RESULTS & REPORTS ====================

/**
 * Get all results for a candidate
 * GET /api/hiring/candidates/:user_id/results
 */
router.get('/candidates/:user_id/results', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;
        const results=await getCandidateResults(user_id);
        res.json(results);
    } catch (error)
    {
        console.error('Get candidate results error:', error);
        res.status(500).json({message: 'Failed to get candidate results', error: error.message});
    }
});

/**
 * Get results for a specific application
 * GET /api/hiring/applications/:application_id/results
 */
router.get('/applications/:application_id/results', async (req, res) =>
{
    try
    {
        const {application_id}=req.params;
        const results=await getApplicationResults(application_id);

        if (!results)
        {
            return res.status(404).json({message: 'Application not found'});
        }

        res.json(results);
    } catch (error)
    {
        console.error('Get application results error:', error);
        res.status(500).json({message: 'Failed to get application results', error: error.message});
    }
});

/**
 * Store assessment result
 * POST /api/hiring/results/assessment
 */
router.post('/results/assessment', async (req, res) =>
{
    try
    {
        const resultId=await storeAssessmentResult(req.body);
        res.json({success: true, result_id: resultId});
    } catch (error)
    {
        console.error('Store assessment result error:', error);
        res.status(500).json({message: 'Failed to store result', error: error.message});
    }
});

/**
 * Generate and store candidate report
 * POST /api/hiring/reports/generate
 */
router.post('/reports/generate', async (req, res) =>
{
    try
    {
        const reportId=await storeCandidateReport(req.body);
        res.json({success: true, report_id: reportId});
    } catch (error)
    {
        console.error('Generate report error:', error);
        res.status(500).json({message: 'Failed to generate report', error: error.message});
    }
});

// ==================== ASSESSMENT SCHEDULING ====================

/**
 * Schedule assessment for candidates
 * POST /api/hiring/assessments/schedule
 */
router.post('/assessments/schedule', async (req, res) =>
{
    try
    {
        const {
            application_ids,
            job_id,
            assessment_type,
            scheduled_at,
            duration_minutes
        }=req.body;

        if (!application_ids?.length||!assessment_type)
        {
            return res.status(400).json({
                message: 'Application IDs and assessment type are required'
            });
        }

        const assessmentIds=[];

        for (const appId of application_ids)
        {
            // Get candidate info
            const [app]=await query(
                'SELECT candidate_user_id FROM applications WHERE id = ?',
                [appId]
            );

            if (app.length)
            {
                const result=await query(
                    `INSERT INTO assessments 
                     (job_id, application_id, candidate_user_id, assessment_type, 
                      status, scheduled_at, duration_minutes)
                     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
                    [
                        job_id,
                        appId,
                        app[0].candidate_user_id,
                        assessment_type,
                        scheduled_at,
                        duration_minutes||60
                    ]
                );

                assessmentIds.push(result.insertId);

                // Update application status
                await query(
                    'UPDATE applications SET status = ? WHERE id = ?',
                    ['screening', appId]
                );

                // Send notification
                await query(
                    `INSERT INTO notifications (user_id, type, title, message, link)
                     VALUES (?, 'assessment_reminder', 'Assessment Scheduled', ?, ?)`,
                    [
                        app[0].candidate_user_id,
                        `You have been scheduled for a ${assessment_type} assessment`,
                        `/assessments/${result.insertId}`
                    ]
                );
            }
        }

        res.json({
            success: true,
            message: `${assessmentIds.length} assessments scheduled`,
            assessment_ids: assessmentIds
        });
    } catch (error)
    {
        console.error('Schedule assessment error:', error);
        res.status(500).json({message: 'Failed to schedule assessments', error: error.message});
    }
});

/**
 * Schedule interview for candidate
 * POST /api/hiring/interviews/schedule
 */
router.post('/interviews/schedule', async (req, res) =>
{
    try
    {
        const {
            application_id,
            candidate_user_id,
            interviewer_user_id,
            interview_type,
            scheduled_at,
            meeting_url
        }=req.body;

        // Generate room ID
        const roomId=`int-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const result=await query(
            `INSERT INTO interviews 
             (interview_type, room_id, candidate_user_id, interviewer_user_id,
              status, scheduled_at, meeting_url)
             VALUES (?, ?, ?, ?, 'scheduled', ?, ?)`,
            [
                interview_type||'live',
                roomId,
                candidate_user_id,
                interviewer_user_id,
                scheduled_at,
                meeting_url
            ]
        );

        // Update application if provided
        if (application_id)
        {
            await query(
                'UPDATE applications SET status = ? WHERE id = ?',
                ['interview_scheduled', application_id]
            );
        }

        res.json({
            success: true,
            interview_id: result.insertId,
            room_id: roomId
        });
    } catch (error)
    {
        console.error('Schedule interview error:', error);
        res.status(500).json({message: 'Failed to schedule interview', error: error.message});
    }
});

// ==================== ANALYTICS ====================

/**
 * Get hiring analytics for a company
 * GET /api/hiring/analytics?company_id=X
 */
router.get('/analytics', async (req, res) =>
{
    try
    {
        const {company_id, job_id, date_from, date_to}=req.query;

        let jobFilter='';
        const params=[];

        if (company_id)
        {
            jobFilter='AND j.company_id = ?';
            params.push(company_id);
        }

        if (job_id)
        {
            jobFilter+=' AND j.id = ?';
            params.push(job_id);
        }

        // Total applications
        const [totalApps]=await query(
            `SELECT COUNT(*) as count FROM applications app
             JOIN jobs j ON app.job_id = j.id
             WHERE 1=1 ${jobFilter}`,
            params
        );

        // Applications by status
        const statusBreakdown=await query(
            `SELECT app.status, COUNT(*) as count 
             FROM applications app
             JOIN jobs j ON app.job_id = j.id
             WHERE 1=1 ${jobFilter}
             GROUP BY app.status`,
            params
        );

        // Average ATS scores
        const [avgATS]=await query(
            `SELECT AVG(ats.overall_score) as avg_score
             FROM ats_scores ats
             JOIN jobs j ON ats.job_id = j.id
             WHERE 1=1 ${jobFilter}`,
            params
        );

        // Top skills in pool
        const skillFrequency=await query(
            `SELECT skill, COUNT(*) as count
             FROM (
                SELECT JSON_UNQUOTE(JSON_EXTRACT(cr.extracted_skills_json, CONCAT('$[', n.n, ']'))) as skill
                FROM candidate_resumes cr
                JOIN applications app ON cr.user_id = app.candidate_user_id
                JOIN jobs j ON app.job_id = j.id
                CROSS JOIN (
                    SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
                ) n
                WHERE 1=1 ${jobFilter}
                AND JSON_UNQUOTE(JSON_EXTRACT(cr.extracted_skills_json, CONCAT('$[', n.n, ']'))) IS NOT NULL
             ) skills
             GROUP BY skill
             ORDER BY count DESC
             LIMIT 10`,
            params
        );

        // Conversion funnel
        const funnel={
            applied: statusBreakdown.find(s => s.status==='applied')?.count||0,
            screening: statusBreakdown.find(s => s.status==='screening')?.count||0,
            interviewed: statusBreakdown.find(s => s.status==='interview_scheduled')?.count||0,
            accepted: statusBreakdown.find(s => s.status==='accepted')?.count||0,
            rejected: statusBreakdown.find(s => s.status==='rejected')?.count||0
        };

        res.json({
            total_applications: totalApps[0]?.count||0,
            status_breakdown: statusBreakdown,
            average_ats_score: Math.round(avgATS[0]?.avg_score||0),
            top_skills: skillFrequency,
            conversion_funnel: funnel,
            conversion_rate: funnel.applied>0
                ? Math.round((funnel.accepted/funnel.applied)*100)
                :0
        });
    } catch (error)
    {
        console.error('Get analytics error:', error);
        res.status(500).json({message: 'Failed to get analytics', error: error.message});
    }
});

export default router;
