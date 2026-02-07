/**
 * Contests Routes
 * Handle contest management, registrations, and results
 */

import express from 'express';
import {query} from '../db/database.js';

const router=express.Router();

// ==================== CONTEST LISTING ====================

/**
 * Get all public contests
 * GET /api/contests
 */
router.get('/', async (req, res) =>
{
    try
    {
        const {status}=req.query;
        const limit=parseInt(req.query.limit)||50;
        const page=parseInt(req.query.page)||1;
        const offset=(page-1)*limit;

        let sql=`
            SELECT 
                c.*,
                (SELECT COUNT(*) FROM contest_registrations WHERE contest_id = c.id) as participant_count,
                u.username as creator_name
            FROM contests c
            LEFT JOIN users u ON c.created_by_user_id = u.id
            WHERE c.is_public = TRUE
        `;
        let params=[];

        if (status)
        {
            // Auto-calculate status based on time
            const now=new Date();
            if (status==='upcoming')
            {
                sql+=' AND c.start_time > ?';
                params.push(now);
            } else if (status==='ongoing'||status==='active')
            {
                sql+=' AND c.start_time <= ? AND c.end_time >= ?';
                params.push(now, now);
            } else if (status==='ended')
            {
                sql+=' AND c.end_time < ?';
                params.push(now);
            }
        }

        // LIMIT and OFFSET must be integers, directly interpolated (safe since we parseInt above)
        sql+=` ORDER BY c.start_time DESC LIMIT ${limit} OFFSET ${offset}`;

        const contests=await query(sql, params);

        // Parse JSON fields
        const parsedContests=contests.map(c => ({
            ...c,
            problems_json: c.problems_json? JSON.parse(c.problems_json):[],
            prizes_json: c.prizes_json? JSON.parse(c.prizes_json):[]
        }));

        res.json({
            success: true,
            contests: parsedContests
        });
    } catch (error)
    {
        console.error('Get contests error:', error);
        res.status(500).json({message: 'Failed to fetch contests', error: error.message});
    }
});

/**
 * Get contest by ID
 * GET /api/contests/:id
 */
router.get('/:id', async (req, res) =>
{
    try
    {
        const {id}=req.params;

        const [contest]=await query(`
            SELECT 
                c.*,
                (SELECT COUNT(*) FROM contest_registrations WHERE contest_id = c.id) as participant_count,
                u.username as creator_name
            FROM contests c
            LEFT JOIN users u ON c.created_by_user_id = u.id
            WHERE c.id = ?
        `, [id]);

        if (!contest)
        {
            return res.status(404).json({message: 'Contest not found'});
        }

        // Parse JSON fields
        contest.problems_json=contest.problems_json? JSON.parse(contest.problems_json):[];
        contest.prizes_json=contest.prizes_json? JSON.parse(contest.prizes_json):[];

        res.json({
            success: true,
            contest
        });
    } catch (error)
    {
        console.error('Get contest error:', error);
        res.status(500).json({message: 'Failed to fetch contest', error: error.message});
    }
});

// ==================== CONTEST CREATION ====================

/**
 * Create a new contest
 * POST /api/contests
 */
router.post('/', async (req, res) =>
{
    try
    {
        const {
            title,
            description,
            start_time,
            end_time,
            duration_minutes=120,
            contest_type='coding',
            difficulty='Mixed',
            max_participants,
            is_public=true,
            requires_registration=true,
            scoring_type='standard',
            problems,
            prizes,
            created_by_user_id,
            company_id
        }=req.body;

        if (!title||!start_time||!end_time)
        {
            return res.status(400).json({message: 'Title, start_time, and end_time are required'});
        }

        const result=await query(`
            INSERT INTO contests 
            (title, description, start_time, end_time, duration_minutes, contest_type, difficulty,
             max_participants, is_public, requires_registration, scoring_type, problems_json, prizes_json,
             created_by_user_id, company_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            title, description, start_time, end_time, duration_minutes, contest_type, difficulty,
            max_participants, is_public, requires_registration, scoring_type,
            problems? JSON.stringify(problems):null,
            prizes? JSON.stringify(prizes):null,
            created_by_user_id, company_id
        ]);

        res.json({
            success: true,
            message: 'Contest created successfully',
            contest_id: result.insertId
        });
    } catch (error)
    {
        console.error('Create contest error:', error);
        res.status(500).json({message: 'Failed to create contest', error: error.message});
    }
});

/**
 * Update a contest
 * PUT /api/contests/:id
 */
router.put('/:id', async (req, res) =>
{
    try
    {
        const {id}=req.params;
        const {
            title,
            description,
            start_time,
            end_time,
            duration_minutes,
            contest_type,
            difficulty,
            max_participants,
            is_public,
            requires_registration,
            scoring_type,
            problems,
            prizes,
            status
        }=req.body;

        // Build dynamic update query
        const updates=[];
        const params=[];

        if (title!==undefined) {updates.push('title = ?'); params.push(title);}
        if (description!==undefined) {updates.push('description = ?'); params.push(description);}
        if (start_time!==undefined) {updates.push('start_time = ?'); params.push(start_time);}
        if (end_time!==undefined) {updates.push('end_time = ?'); params.push(end_time);}
        if (duration_minutes!==undefined) {updates.push('duration_minutes = ?'); params.push(duration_minutes);}
        if (contest_type!==undefined) {updates.push('contest_type = ?'); params.push(contest_type);}
        if (difficulty!==undefined) {updates.push('difficulty = ?'); params.push(difficulty);}
        if (max_participants!==undefined) {updates.push('max_participants = ?'); params.push(max_participants);}
        if (is_public!==undefined) {updates.push('is_public = ?'); params.push(is_public);}
        if (requires_registration!==undefined) {updates.push('requires_registration = ?'); params.push(requires_registration);}
        if (scoring_type!==undefined) {updates.push('scoring_type = ?'); params.push(scoring_type);}
        if (problems!==undefined) {updates.push('problems_json = ?'); params.push(JSON.stringify(problems));}
        if (prizes!==undefined) {updates.push('prizes_json = ?'); params.push(JSON.stringify(prizes));}
        if (status!==undefined) {updates.push('status = ?'); params.push(status);}

        if (updates.length===0)
        {
            return res.status(400).json({message: 'No updates provided'});
        }

        params.push(id);
        await query(`UPDATE contests SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({
            success: true,
            message: 'Contest updated successfully'
        });
    } catch (error)
    {
        console.error('Update contest error:', error);
        res.status(500).json({message: 'Failed to update contest', error: error.message});
    }
});

// ==================== REGISTRATION ====================

/**
 * Register for a contest
 * POST /api/contests/:id/register
 */
router.post('/:id/register', async (req, res) =>
{
    try
    {
        const {id}=req.params;
        const {user_id}=req.body;

        if (!user_id)
        {
            return res.status(400).json({message: 'user_id is required'});
        }

        // Check if contest exists and registration is open
        const [contest]=await query('SELECT * FROM contests WHERE id = ?', [id]);

        if (!contest)
        {
            return res.status(404).json({message: 'Contest not found'});
        }

        const now=new Date();
        const startTime=new Date(contest.start_time);

        if (now>startTime)
        {
            return res.status(400).json({message: 'Registration closed - contest has started'});
        }

        // Check max participants
        if (contest.max_participants)
        {
            const [countResult]=await query(
                'SELECT COUNT(*) as count FROM contest_registrations WHERE contest_id = ?',
                [id]
            );

            if (countResult.count>=contest.max_participants)
            {
                return res.status(400).json({message: 'Contest is full'});
            }
        }

        // Register user
        await query(`
            INSERT INTO contest_registrations (contest_id, user_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE registered_at = NOW()
        `, [id, user_id]);

        res.json({
            success: true,
            message: 'Registered successfully'
        });
    } catch (error)
    {
        console.error('Register for contest error:', error);
        res.status(500).json({message: 'Failed to register', error: error.message});
    }
});

/**
 * Get user's contest registrations
 * GET /api/contests/user/:userId/registrations
 */
router.get('/user/:userId/registrations', async (req, res) =>
{
    try
    {
        const {userId}=req.params;

        const registrations=await query(`
            SELECT 
                cr.*,
                c.title,
                c.start_time,
                c.end_time,
                c.status as contest_status
            FROM contest_registrations cr
            JOIN contests c ON cr.contest_id = c.id
            WHERE cr.user_id = ?
            ORDER BY c.start_time DESC
        `, [userId]);

        res.json({
            success: true,
            registrations
        });
    } catch (error)
    {
        console.error('Get registrations error:', error);
        res.status(500).json({message: 'Failed to fetch registrations', error: error.message});
    }
});

// ==================== SUBMISSIONS ====================

/**
 * Submit solution for a contest problem
 * POST /api/contests/:id/submit
 */
router.post('/:id/submit', async (req, res) =>
{
    try
    {
        const {id}=req.params;
        const {user_id, problem_id, code, language}=req.body;

        if (!user_id||!code||!language)
        {
            return res.status(400).json({message: 'user_id, code, and language are required'});
        }

        // Check if user is registered
        const [registration]=await query(
            'SELECT * FROM contest_registrations WHERE contest_id = ? AND user_id = ?',
            [id, user_id]
        );

        if (!registration)
        {
            return res.status(403).json({message: 'You are not registered for this contest'});
        }

        // Check if contest is active
        const [contest]=await query('SELECT * FROM contests WHERE id = ?', [id]);
        const now=new Date();
        const startTime=new Date(contest.start_time);
        const endTime=new Date(contest.end_time);

        if (now<startTime||now>endTime)
        {
            return res.status(400).json({message: 'Contest is not active'});
        }

        // Record submission (actual code execution would be handled by code executor)
        const result=await query(`
            INSERT INTO contest_submissions 
            (contest_id, user_id, problem_id, code, language, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `, [id, user_id, problem_id, code, language]);

        res.json({
            success: true,
            message: 'Submission recorded',
            submission_id: result.insertId
        });
    } catch (error)
    {
        console.error('Submit error:', error);
        res.status(500).json({message: 'Failed to submit', error: error.message});
    }
});

// ==================== LEADERBOARD & RESULTS ====================

/**
 * Get contest leaderboard
 * GET /api/contests/:id/leaderboard
 */
router.get('/:id/leaderboard', async (req, res) =>
{
    try
    {
        const {id}=req.params;
        const {limit=50}=req.query;

        const leaderboard=await query(`
            SELECT 
                u.id as user_id,
                u.username,
                u.full_name,
                SUM(cs.score) as total_score,
                COUNT(DISTINCT cs.problem_id) as problems_attempted,
                SUM(CASE WHEN cs.status = 'accepted' THEN 1 ELSE 0 END) as problems_solved,
                MIN(cs.submitted_at) as first_submission,
                MAX(cs.submitted_at) as last_submission,
                SUM(cs.time_taken_seconds) as total_time
            FROM contest_submissions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.contest_id = ?
            GROUP BY u.id, u.username, u.full_name
            ORDER BY total_score DESC, total_time ASC
            LIMIT ?
        `, [id, parseInt(limit)]);

        const rankedLeaderboard=leaderboard.map((entry, index) => ({
            rank: index+1,
            ...entry
        }));

        res.json({
            success: true,
            leaderboard: rankedLeaderboard
        });
    } catch (error)
    {
        console.error('Get contest leaderboard error:', error);
        res.status(500).json({message: 'Failed to fetch leaderboard', error: error.message});
    }
});

/**
 * Get user's contest results
 * GET /api/contests/:id/results/:userId
 */
router.get('/:id/results/:userId', async (req, res) =>
{
    try
    {
        const {id, userId}=req.params;

        const submissions=await query(`
            SELECT * FROM contest_submissions
            WHERE contest_id = ? AND user_id = ?
            ORDER BY submitted_at DESC
        `, [id, userId]);

        // Calculate summary
        const summary={
            total_submissions: submissions.length,
            problems_solved: submissions.filter(s => s.status==='accepted').length,
            total_score: submissions.reduce((sum, s) => sum+(s.score||0), 0),
            total_time: submissions.reduce((sum, s) => sum+(s.time_taken_seconds||0), 0)
        };

        res.json({
            success: true,
            submissions,
            summary
        });
    } catch (error)
    {
        console.error('Get results error:', error);
        res.status(500).json({message: 'Failed to fetch results', error: error.message});
    }
});

export default router;
