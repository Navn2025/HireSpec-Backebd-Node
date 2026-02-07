/**
 * Company Challenges Routes
 * Endpoints for companies to create and manage their own coding challenges
 */

import express from 'express';
import {query} from '../db/database.js';

const router=express.Router();

// ==================== CHALLENGE MANAGEMENT ====================

/**
 * Create a new challenge
 * POST /api/challenges
 */
router.post('/', async (req, res) =>
{
    try
    {
        const {
            company_id,
            created_by_user_id,
            title,
            description,
            difficulty,
            category,
            topics,
            time_limit_minutes,
            starter_code_js,
            starter_code_python,
            starter_code_java,
            test_cases,
            constraints,
            hints,
            solution_approach,
            is_public,
            job_id
        }=req.body;

        if (!title||!description||!difficulty)
        {
            return res.status(400).json({message: 'Title, description, and difficulty are required'});
        }

        const result=await query(
            `INSERT INTO company_challenges 
             (company_id, created_by_user_id, job_id, title, description, difficulty,
              category, topics_json, time_limit_minutes, starter_code_js, starter_code_python,
              starter_code_java, test_cases_json, constraints, hints_json, solution_approach,
              is_public, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [
                company_id,
                created_by_user_id,
                job_id,
                title,
                description,
                difficulty,
                category||'General',
                JSON.stringify(topics||[]),
                time_limit_minutes||30,
                starter_code_js||'',
                starter_code_python||'',
                starter_code_java||'',
                JSON.stringify(test_cases||[]),
                constraints||'',
                JSON.stringify(hints||[]),
                solution_approach||'',
                is_public!==false
            ]
        );

        res.json({
            success: true,
            message: 'Challenge created successfully',
            challenge_id: result.insertId
        });
    } catch (error)
    {
        console.error('Create challenge error:', error);
        res.status(500).json({message: 'Failed to create challenge', error: error.message});
    }
});

/**
 * Get all challenges for a company
 * GET /api/challenges?company_id=X
 */
router.get('/', async (req, res) =>
{
    try
    {
        const {company_id, job_id, difficulty, status, page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT ch.*, 
                   c.name as company_name,
                   u.username as created_by_username,
                   j.title as job_title,
                   (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = ch.id) as submission_count,
                   (SELECT COUNT(DISTINCT user_id) FROM challenge_submissions WHERE challenge_id = ch.id) as participant_count
            FROM company_challenges ch
            LEFT JOIN companies c ON ch.company_id = c.id
            LEFT JOIN users u ON ch.created_by_user_id = u.id
            LEFT JOIN jobs j ON ch.job_id = j.id
            WHERE 1=1
        `;
        let params=[];

        if (company_id)
        {
            sql+=' AND ch.company_id = ?';
            params.push(company_id);
        }

        if (job_id)
        {
            sql+=' AND ch.job_id = ?';
            params.push(job_id);
        }

        if (difficulty)
        {
            sql+=' AND ch.difficulty = ?';
            params.push(difficulty);
        }

        if (status)
        {
            sql+=' AND ch.status = ?';
            params.push(status);
        }

        sql+=' ORDER BY ch.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const challenges=await query(sql, params);

        // Parse JSON fields
        const parsedChallenges=challenges.map(ch => ({
            ...ch,
            topics: ch.topics_json? JSON.parse(ch.topics_json):[],
            test_cases: ch.test_cases_json? JSON.parse(ch.test_cases_json):[],
            hints: ch.hints_json? JSON.parse(ch.hints_json):[]
        }));

        res.json({challenges: parsedChallenges});
    } catch (error)
    {
        console.error('Get challenges error:', error);
        res.status(500).json({message: 'Failed to fetch challenges', error: error.message});
    }
});

/**
 * Get single challenge by ID
 * GET /api/challenges/:challenge_id
 */
router.get('/:challenge_id', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;

        const [challenge]=await query(
            `SELECT ch.*, c.name as company_name, u.username as created_by_username
             FROM company_challenges ch
             LEFT JOIN companies c ON ch.company_id = c.id
             LEFT JOIN users u ON ch.created_by_user_id = u.id
             WHERE ch.id = ?`,
            [challenge_id]
        );

        if (!challenge)
        {
            return res.status(404).json({message: 'Challenge not found'});
        }

        // Parse JSON fields
        challenge.topics=challenge.topics_json? JSON.parse(challenge.topics_json):[];
        challenge.test_cases=challenge.test_cases_json? JSON.parse(challenge.test_cases_json):[];
        challenge.hints=challenge.hints_json? JSON.parse(challenge.hints_json):[];

        res.json({challenge});
    } catch (error)
    {
        console.error('Get challenge error:', error);
        res.status(500).json({message: 'Failed to fetch challenge', error: error.message});
    }
});

/**
 * Update challenge
 * PUT /api/challenges/:challenge_id
 */
router.put('/:challenge_id', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;
        const updates=req.body;

        const allowedFields=[
            'title', 'description', 'difficulty', 'category',
            'time_limit_minutes', 'starter_code_js', 'starter_code_python',
            'starter_code_java', 'constraints', 'solution_approach', 'is_public', 'status'
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

        if (updates.topics)
        {
            setClauses.push('topics_json = ?');
            params.push(JSON.stringify(updates.topics));
        }

        if (updates.test_cases)
        {
            setClauses.push('test_cases_json = ?');
            params.push(JSON.stringify(updates.test_cases));
        }

        if (updates.hints)
        {
            setClauses.push('hints_json = ?');
            params.push(JSON.stringify(updates.hints));
        }

        if (setClauses.length===0)
        {
            return res.status(400).json({message: 'No updates provided'});
        }

        params.push(challenge_id);
        await query(
            `UPDATE company_challenges SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );

        res.json({success: true, message: 'Challenge updated successfully'});
    } catch (error)
    {
        console.error('Update challenge error:', error);
        res.status(500).json({message: 'Failed to update challenge', error: error.message});
    }
});

/**
 * Delete challenge
 * DELETE /api/challenges/:challenge_id
 */
router.delete('/:challenge_id', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;

        await query('DELETE FROM company_challenges WHERE id = ?', [challenge_id]);

        res.json({success: true, message: 'Challenge deleted successfully'});
    } catch (error)
    {
        console.error('Delete challenge error:', error);
        res.status(500).json({message: 'Failed to delete challenge', error: error.message});
    }
});

// ==================== CHALLENGE SUBMISSIONS ====================

/**
 * Submit solution for a challenge
 * POST /api/challenges/:challenge_id/submit
 */
router.post('/:challenge_id/submit', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;
        const {user_id, language, code, execution_time_ms, test_cases_passed, test_cases_total}=req.body;

        if (!user_id||!language||!code)
        {
            return res.status(400).json({message: 'User ID, language, and code are required'});
        }

        // Calculate score based on test cases passed
        const score=test_cases_total>0
            ? Math.round((test_cases_passed/test_cases_total)*100)
            :0;

        const status=test_cases_passed===test_cases_total? 'accepted':'partial';

        const result=await query(
            `INSERT INTO challenge_submissions 
             (challenge_id, user_id, language, code, execution_time_ms, 
              test_cases_passed, test_cases_total, score, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                challenge_id,
                user_id,
                language,
                code,
                execution_time_ms||0,
                test_cases_passed||0,
                test_cases_total||0,
                score,
                status
            ]
        );

        res.json({
            success: true,
            submission_id: result.insertId,
            score,
            status
        });
    } catch (error)
    {
        console.error('Submit solution error:', error);
        res.status(500).json({message: 'Failed to submit solution', error: error.message});
    }
});

/**
 * Get submissions for a challenge
 * GET /api/challenges/:challenge_id/submissions
 */
router.get('/:challenge_id/submissions', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;
        const {user_id, page=1, limit=50}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT cs.*, u.username, u.email
            FROM challenge_submissions cs
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cs.challenge_id = ?
        `;
        let params=[challenge_id];

        if (user_id)
        {
            sql+=' AND cs.user_id = ?';
            params.push(user_id);
        }

        sql+=' ORDER BY cs.submitted_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const submissions=await query(sql, params);

        res.json({submissions});
    } catch (error)
    {
        console.error('Get submissions error:', error);
        res.status(500).json({message: 'Failed to fetch submissions', error: error.message});
    }
});

// ==================== LEADERBOARD ====================

/**
 * Get leaderboard for a challenge
 * GET /api/challenges/:challenge_id/leaderboard
 */
router.get('/:challenge_id/leaderboard', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;
        const {limit=50}=req.query;

        const leaderboard=await query(
            `SELECT 
                u.id as user_id,
                u.username,
                u.email,
                MAX(cs.score) as best_score,
                MIN(cs.execution_time_ms) as best_time,
                COUNT(cs.id) as attempt_count,
                MAX(cs.submitted_at) as last_submission,
                (SELECT status FROM challenge_submissions 
                 WHERE challenge_id = ? AND user_id = u.id 
                 ORDER BY score DESC, execution_time_ms ASC LIMIT 1) as best_status
             FROM challenge_submissions cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.challenge_id = ?
             GROUP BY u.id, u.username, u.email
             ORDER BY best_score DESC, best_time ASC
             LIMIT ?`,
            [challenge_id, challenge_id, parseInt(limit)]
        );

        // Add rank
        const rankedLeaderboard=leaderboard.map((entry, index) => ({
            rank: index+1,
            ...entry
        }));

        res.json({leaderboard: rankedLeaderboard});
    } catch (error)
    {
        console.error('Get leaderboard error:', error);
        res.status(500).json({message: 'Failed to fetch leaderboard', error: error.message});
    }
});

/**
 * Get company-wide leaderboard across all challenges
 * GET /api/challenges/leaderboard/company/:company_id
 */
router.get('/leaderboard/company/:company_id', async (req, res) =>
{
    try
    {
        const {company_id}=req.params;
        const {job_id, limit=50}=req.query;

        let sql=`
            SELECT 
                u.id as user_id,
                u.username,
                u.email,
                COUNT(DISTINCT cs.challenge_id) as challenges_attempted,
                SUM(CASE WHEN cs.status = 'accepted' THEN 1 ELSE 0 END) as challenges_solved,
                ROUND(AVG(cs.score), 2) as avg_score,
                ROUND(AVG(cs.execution_time_ms), 2) as avg_time,
                SUM(cs.score) as total_score,
                MAX(cs.submitted_at) as last_activity
             FROM challenge_submissions cs
             JOIN company_challenges ch ON cs.challenge_id = ch.id
             JOIN users u ON cs.user_id = u.id
             WHERE ch.company_id = ?
        `;
        let params=[company_id];

        if (job_id)
        {
            sql+=' AND ch.job_id = ?';
            params.push(job_id);
        }

        sql+=` GROUP BY u.id, u.username, u.email
                 ORDER BY total_score DESC, challenges_solved DESC, avg_time ASC
                 LIMIT ?`;
        params.push(parseInt(limit));

        const leaderboard=await query(sql, params);

        const rankedLeaderboard=leaderboard.map((entry, index) => ({
            rank: index+1,
            ...entry
        }));

        res.json({leaderboard: rankedLeaderboard});
    } catch (error)
    {
        console.error('Get company leaderboard error:', error);
        res.status(500).json({message: 'Failed to fetch company leaderboard', error: error.message});
    }
});

// ==================== SHORTLISTING ====================

/**
 * Shortlist candidates based on challenge performance
 * POST /api/challenges/shortlist
 */
router.post('/shortlist', async (req, res) =>
{
    try
    {
        const {
            company_id,
            job_id,
            challenge_ids,
            min_score,
            min_challenges_solved,
            max_candidates
        }=req.body;

        if (!company_id&&!job_id&&!challenge_ids?.length)
        {
            return res.status(400).json({
                message: 'At least one filter (company_id, job_id, or challenge_ids) is required'
            });
        }

        let sql=`
            SELECT 
                u.id as user_id,
                u.username,
                u.email,
                u.phone,
                u.experience_years,
                COUNT(DISTINCT cs.challenge_id) as challenges_attempted,
                SUM(CASE WHEN cs.status = 'accepted' THEN 1 ELSE 0 END) as challenges_solved,
                ROUND(AVG(cs.score), 2) as avg_score,
                MAX(cs.score) as best_score,
                ROUND(AVG(cs.execution_time_ms), 2) as avg_time
             FROM challenge_submissions cs
             JOIN company_challenges ch ON cs.challenge_id = ch.id
             JOIN users u ON cs.user_id = u.id
             WHERE 1=1
        `;
        let params=[];

        if (company_id)
        {
            sql+=' AND ch.company_id = ?';
            params.push(company_id);
        }

        if (job_id)
        {
            sql+=' AND ch.job_id = ?';
            params.push(job_id);
        }

        if (challenge_ids?.length)
        {
            sql+=` AND cs.challenge_id IN (${challenge_ids.map(() => '?').join(',')})`;
            params.push(...challenge_ids);
        }

        sql+=` GROUP BY u.id, u.username, u.email, u.phone, u.experience_years`;

        if (min_score)
        {
            sql+=` HAVING avg_score >= ?`;
            params.push(min_score);
        }

        if (min_challenges_solved)
        {
            sql+=min_score? ' AND':' HAVING';
            sql+=` challenges_solved >= ?`;
            params.push(min_challenges_solved);
        }

        sql+=` ORDER BY avg_score DESC, challenges_solved DESC, avg_time ASC`;

        if (max_candidates)
        {
            sql+=` LIMIT ?`;
            params.push(parseInt(max_candidates));
        }

        const candidates=await query(sql, params);

        // Add recommendation tier
        const shortlistedCandidates=candidates.map((c, index) => ({
            rank: index+1,
            ...c,
            tier: c.avg_score>=90? 'excellent':
                c.avg_score>=75? 'good':
                    c.avg_score>=60? 'average':'needs_improvement',
            recommendation: c.avg_score>=80&&c.challenges_solved>=(min_challenges_solved||1)
                ? 'highly_recommended'
                :c.avg_score>=60? 'recommended':'consider'
        }));

        res.json({
            shortlisted_candidates: shortlistedCandidates,
            total_count: shortlistedCandidates.length
        });
    } catch (error)
    {
        console.error('Shortlist candidates error:', error);
        res.status(500).json({message: 'Failed to shortlist candidates', error: error.message});
    }
});

/**
 * Save shortlisted candidates for a job
 * POST /api/challenges/shortlist/save
 */
router.post('/shortlist/save', async (req, res) =>
{
    try
    {
        const {job_id, company_id, user_ids, notes}=req.body;

        if (!user_ids?.length)
        {
            return res.status(400).json({message: 'At least one user_id is required'});
        }

        const shortlistIds=[];

        for (const user_id of user_ids)
        {
            // Check if already shortlisted
            const existing=await query(
                'SELECT id FROM candidate_shortlist WHERE job_id = ? AND user_id = ?',
                [job_id, user_id]
            );

            if (existing.length===0)
            {
                const result=await query(
                    `INSERT INTO candidate_shortlist (company_id, job_id, user_id, notes, status)
                     VALUES (?, ?, ?, ?, 'active')`,
                    [company_id, job_id, user_id, notes||null]
                );
                shortlistIds.push(result.insertId);
            }
        }

        res.json({
            success: true,
            message: `${shortlistIds.length} candidates shortlisted`,
            shortlist_ids: shortlistIds
        });
    } catch (error)
    {
        console.error('Save shortlist error:', error);
        res.status(500).json({message: 'Failed to save shortlist', error: error.message});
    }
});

/**
 * Get shortlisted candidates for a job
 * GET /api/challenges/shortlist/:job_id
 */
router.get('/shortlist/:job_id', async (req, res) =>
{
    try
    {
        const {job_id}=req.params;

        const shortlisted=await query(
            `SELECT sl.*, u.username, u.email, u.phone, u.experience_years,
                    (SELECT ROUND(AVG(score), 2) FROM challenge_submissions cs 
                     JOIN company_challenges ch ON cs.challenge_id = ch.id 
                     WHERE cs.user_id = sl.user_id AND ch.job_id = ?) as avg_challenge_score
             FROM candidate_shortlist sl
             JOIN users u ON sl.user_id = u.id
             WHERE sl.job_id = ? AND sl.status = 'active'
             ORDER BY sl.created_at DESC`,
            [job_id, job_id]
        );

        res.json({shortlisted});
    } catch (error)
    {
        console.error('Get shortlist error:', error);
        res.status(500).json({message: 'Failed to fetch shortlist', error: error.message});
    }
});

/**
 * Remove candidate from shortlist
 * DELETE /api/challenges/shortlist/:job_id/:user_id
 */
router.delete('/shortlist/:job_id/:user_id', async (req, res) =>
{
    try
    {
        const {job_id, user_id}=req.params;

        await query(
            'UPDATE candidate_shortlist SET status = ? WHERE job_id = ? AND user_id = ?',
            ['removed', job_id, user_id]
        );

        res.json({success: true, message: 'Candidate removed from shortlist'});
    } catch (error)
    {
        console.error('Remove from shortlist error:', error);
        res.status(500).json({message: 'Failed to remove from shortlist', error: error.message});
    }
});

// ==================== CHALLENGE ANALYTICS ====================

/**
 * Get challenge analytics
 * GET /api/challenges/:challenge_id/analytics
 */
router.get('/:challenge_id/analytics', async (req, res) =>
{
    try
    {
        const {challenge_id}=req.params;

        // Get submission stats
        const [stats]=await query(
            `SELECT 
                COUNT(*) as total_submissions,
                COUNT(DISTINCT user_id) as unique_participants,
                ROUND(AVG(score), 2) as avg_score,
                MAX(score) as max_score,
                MIN(score) as min_score,
                ROUND(AVG(execution_time_ms), 2) as avg_time,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count
             FROM challenge_submissions
             WHERE challenge_id = ?`,
            [challenge_id]
        );

        // Score distribution
        const scoreDistribution=await query(
            `SELECT 
                CASE 
                    WHEN score >= 90 THEN '90-100'
                    WHEN score >= 80 THEN '80-89'
                    WHEN score >= 70 THEN '70-79'
                    WHEN score >= 60 THEN '60-69'
                    ELSE 'Below 60'
                END as score_range,
                COUNT(*) as count
             FROM challenge_submissions
             WHERE challenge_id = ?
             GROUP BY score_range
             ORDER BY score_range DESC`,
            [challenge_id]
        );

        // Language distribution
        const languageDistribution=await query(
            `SELECT language, COUNT(*) as count
             FROM challenge_submissions
             WHERE challenge_id = ?
             GROUP BY language
             ORDER BY count DESC`,
            [challenge_id]
        );

        // Submissions over time (last 30 days)
        const submissionTrend=await query(
            `SELECT DATE(submitted_at) as date, COUNT(*) as count
             FROM challenge_submissions
             WHERE challenge_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(submitted_at)
             ORDER BY date ASC`,
            [challenge_id]
        );

        res.json({
            stats,
            score_distribution: scoreDistribution,
            language_distribution: languageDistribution,
            submission_trend: submissionTrend,
            success_rate: stats.total_submissions>0
                ? Math.round((stats.accepted_count/stats.total_submissions)*100)
                :0
        });
    } catch (error)
    {
        console.error('Get challenge analytics error:', error);
        res.status(500).json({message: 'Failed to fetch analytics', error: error.message});
    }
});

export default router;
