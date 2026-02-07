/**
 * Scores & Leaderboard Routes
 * Track user scores and display leaderboards
 */

import express from 'express';
import {query} from '../db/database.js';

const router=express.Router();

// ==================== SCORE MANAGEMENT ====================

/**
 * Record a new score
 * POST /api/scores
 */
router.post('/', async (req, res) =>
{
    try
    {
        const {
            userId,
            activity_type,
            activity_id,
            score,
            max_score=100,
            activity_title,
            difficulty,
            duration_seconds,
            problems_solved,
            total_problems,
            skills_assessed
        }=req.body;

        if (!userId||!activity_type||score===undefined)
        {
            return res.status(400).json({message: 'userId, activity_type, and score are required'});
        }

        // Insert score record
        const result=await query(`
            INSERT INTO user_scores 
            (user_id, activity_type, activity_id, score, max_score, activity_title, 
             difficulty, duration_seconds, problems_solved, total_problems, skills_assessed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId, activity_type, activity_id, score, max_score, activity_title,
            difficulty, duration_seconds, problems_solved, total_problems,
            skills_assessed? JSON.stringify(skills_assessed):null
        ]);

        // Update leaderboard stats
        await updateLeaderboardStats(userId);

        // Update user skills if skills_assessed provided
        if (skills_assessed&&skills_assessed.length>0)
        {
            await updateUserSkills(userId, skills_assessed, score/max_score*100);
        }

        res.json({
            success: true,
            message: 'Score recorded successfully',
            score_id: result.insertId
        });
    } catch (error)
    {
        console.error('Record score error:', error);
        res.status(500).json({message: 'Failed to record score', error: error.message});
    }
});

/**
 * Get user's score history
 * GET /api/scores/:userId
 */
router.get('/:userId', async (req, res) =>
{
    try
    {
        const {userId}=req.params;
        const {activity_type, page=1, limit=20}=req.query;
        const offset=(page-1)*limit;

        let sql=`
            SELECT * FROM user_scores 
            WHERE user_id = ?
        `;
        let params=[userId];

        if (activity_type)
        {
            sql+=' AND activity_type = ?';
            params.push(activity_type);
        }

        sql+=' ORDER BY completed_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const scores=await query(sql, params);

        // Get total count
        let countSql='SELECT COUNT(*) as total FROM user_scores WHERE user_id = ?';
        let countParams=[userId];
        if (activity_type)
        {
            countSql+=' AND activity_type = ?';
            countParams.push(activity_type);
        }
        const [countResult]=await query(countSql, countParams);

        // Parse skills_assessed JSON
        const parsedScores=scores.map(s => ({
            ...s,
            skills_assessed: s.skills_assessed? JSON.parse(s.skills_assessed):[]
        }));

        res.json({
            success: true,
            scores: parsedScores,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult?.total||0,
                totalPages: Math.ceil((countResult?.total||0)/limit)
            }
        });
    } catch (error)
    {
        console.error('Get scores error:', error);
        res.status(500).json({message: 'Failed to fetch scores', error: error.message});
    }
});

/**
 * Get user's summary stats
 * GET /api/scores/:userId/summary
 */
router.get('/:userId/summary', async (req, res) =>
{
    try
    {
        const {userId}=req.params;

        // Get leaderboard stats
        const [stats]=await query(`
            SELECT * FROM user_leaderboard_stats WHERE user_id = ?
        `, [userId]);

        // Get recent activity breakdown
        const activityBreakdown=await query(`
            SELECT 
                activity_type,
                COUNT(*) as count,
                AVG(percentage) as avg_score,
                SUM(score) as total_score,
                MAX(completed_at) as last_activity
            FROM user_scores
            WHERE user_id = ?
            GROUP BY activity_type
        `, [userId]);

        // Get streak info
        const streakInfo=await calculateStreak(userId);

        res.json({
            success: true,
            stats: stats||{
                total_score: 0,
                total_activities: 0,
                average_score: 0,
                coding_score: 0,
                interview_score: 0,
                global_rank: 0
            },
            activity_breakdown: activityBreakdown,
            streak: streakInfo
        });
    } catch (error)
    {
        console.error('Get summary error:', error);
        res.status(500).json({message: 'Failed to fetch summary', error: error.message});
    }
});

// ==================== LEADERBOARD ====================

/**
 * Get global leaderboard
 * GET /api/scores/leaderboard/global
 */
router.get('/leaderboard/global', async (req, res) =>
{
    try
    {
        const {page=1, limit=50, timeframe='all'}=req.query;
        const offset=(page-1)*limit;

        let scoreQuery;
        let params=[];

        if (timeframe==='weekly')
        {
            // Get weekly scores
            scoreQuery=`
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.full_name,
                    u.profile_image,
                    COALESCE(SUM(us.score), 0) as period_score,
                    COUNT(us.id) as activities_count,
                    COALESCE(AVG(us.percentage), 0) as avg_percentage
                FROM users u
                LEFT JOIN user_scores us ON u.id = us.user_id 
                    AND us.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                WHERE u.role = 'candidate'
                GROUP BY u.id
                HAVING period_score > 0
                ORDER BY period_score DESC
                LIMIT ? OFFSET ?
            `;
        } else if (timeframe==='monthly')
        {
            scoreQuery=`
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.full_name,
                    u.profile_image,
                    COALESCE(SUM(us.score), 0) as period_score,
                    COUNT(us.id) as activities_count,
                    COALESCE(AVG(us.percentage), 0) as avg_percentage
                FROM users u
                LEFT JOIN user_scores us ON u.id = us.user_id 
                    AND us.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                WHERE u.role = 'candidate'
                GROUP BY u.id
                HAVING period_score > 0
                ORDER BY period_score DESC
                LIMIT ? OFFSET ?
            `;
        } else
        {
            // All time from leaderboard stats
            scoreQuery=`
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.full_name,
                    u.profile_image,
                    COALESCE(ls.total_score, 0) as period_score,
                    COALESCE(ls.total_activities, 0) as activities_count,
                    COALESCE(ls.average_score, 0) as avg_percentage,
                    ls.coding_problems_solved,
                    ls.interview_count,
                    ls.current_streak_days,
                    ls.badges
                FROM users u
                LEFT JOIN user_leaderboard_stats ls ON u.id = ls.user_id
                WHERE u.role = 'candidate' AND ls.total_score > 0
                ORDER BY ls.total_score DESC
                LIMIT ? OFFSET ?
            `;
        }

        params.push(parseInt(limit), parseInt(offset));
        const leaderboard=await query(scoreQuery, params);

        // Add rank to each entry
        const rankedLeaderboard=leaderboard.map((entry, index) => ({
            ...entry,
            rank: offset+index+1,
            badges: entry.badges? JSON.parse(entry.badges):[]
        }));

        // Get total count
        const [countResult]=await query(`
            SELECT COUNT(*) as total 
            FROM users u 
            LEFT JOIN user_leaderboard_stats ls ON u.id = ls.user_id 
            WHERE u.role = 'candidate' AND COALESCE(ls.total_score, 0) > 0
        `);

        res.json({
            success: true,
            leaderboard: rankedLeaderboard,
            timeframe,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult?.total||0,
                totalPages: Math.ceil((countResult?.total||0)/limit)
            }
        });
    } catch (error)
    {
        console.error('Get leaderboard error:', error);
        res.status(500).json({message: 'Failed to fetch leaderboard', error: error.message});
    }
});

/**
 * Get category-specific leaderboard
 * GET /api/scores/leaderboard/:category
 */
router.get('/leaderboard/:category', async (req, res) =>
{
    try
    {
        const {category}=req.params; // coding, interview, contest
        const {page=1, limit=50}=req.query;
        const offset=(page-1)*limit;

        let scoreColumn;
        let countColumn;

        switch (category)
        {
            case 'coding':
                scoreColumn='coding_score';
                countColumn='coding_problems_solved';
                break;
            case 'interview':
                scoreColumn='interview_score';
                countColumn='interview_count';
                break;
            case 'contest':
                scoreColumn='contest_score';
                countColumn='contest_count';
                break;
            case 'challenge':
                scoreColumn='challenge_score';
                countColumn='challenge_count';
                break;
            default:
                return res.status(400).json({message: 'Invalid category'});
        }

        const leaderboard=await query(`
            SELECT 
                u.id as user_id,
                u.username,
                u.full_name,
                u.profile_image,
                COALESCE(ls.${scoreColumn}, 0) as category_score,
                COALESCE(ls.${countColumn}, 0) as category_count,
                ls.badges
            FROM users u
            LEFT JOIN user_leaderboard_stats ls ON u.id = ls.user_id
            WHERE u.role = 'candidate' AND COALESCE(ls.${scoreColumn}, 0) > 0
            ORDER BY ls.${scoreColumn} DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const rankedLeaderboard=leaderboard.map((entry, index) => ({
            ...entry,
            rank: offset+index+1,
            badges: entry.badges? JSON.parse(entry.badges):[]
        }));

        res.json({
            success: true,
            leaderboard: rankedLeaderboard,
            category,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error)
    {
        console.error('Get category leaderboard error:', error);
        res.status(500).json({message: 'Failed to fetch leaderboard', error: error.message});
    }
});

/**
 * Get user's rank
 * GET /api/scores/:userId/rank
 */
router.get('/:userId/rank', async (req, res) =>
{
    try
    {
        const {userId}=req.params;

        // Get user's leaderboard stats
        const [userStats]=await query(`
            SELECT * FROM user_leaderboard_stats WHERE user_id = ?
        `, [userId]);

        if (!userStats)
        {
            return res.json({
                success: true,
                rank: {
                    global: null,
                    coding: null,
                    interview: null,
                    message: 'No activity recorded yet'
                }
            });
        }

        // Calculate current global rank
        const [globalRankResult]=await query(`
            SELECT COUNT(*) + 1 as rank
            FROM user_leaderboard_stats
            WHERE total_score > ?
        `, [userStats.total_score]);

        // Calculate coding rank
        const [codingRankResult]=await query(`
            SELECT COUNT(*) + 1 as rank
            FROM user_leaderboard_stats
            WHERE coding_score > ?
        `, [userStats.coding_score]);

        // Calculate interview rank
        const [interviewRankResult]=await query(`
            SELECT COUNT(*) + 1 as rank
            FROM user_leaderboard_stats
            WHERE interview_score > ?
        `, [userStats.interview_score]);

        res.json({
            success: true,
            rank: {
                global: globalRankResult?.rank||1,
                coding: codingRankResult?.rank||1,
                interview: interviewRankResult?.rank||1
            },
            stats: userStats
        });
    } catch (error)
    {
        console.error('Get rank error:', error);
        res.status(500).json({message: 'Failed to fetch rank', error: error.message});
    }
});

// ==================== USER SKILLS ====================

/**
 * Get user's skills
 * GET /api/scores/:userId/skills
 */
router.get('/:userId/skills', async (req, res) =>
{
    try
    {
        const {userId}=req.params;

        const skills=await query(`
            SELECT * FROM user_skills
            WHERE user_id = ?
            ORDER BY score DESC, proficiency_level DESC
        `, [userId]);

        res.json({
            success: true,
            skills
        });
    } catch (error)
    {
        console.error('Get skills error:', error);
        res.status(500).json({message: 'Failed to fetch skills', error: error.message});
    }
});

/**
 * Add or update user skill
 * POST /api/scores/:userId/skills
 */
router.post('/:userId/skills', async (req, res) =>
{
    try
    {
        const {userId}=req.params;
        const {skill_name, skill_category, proficiency_level, years_experience}=req.body;

        if (!skill_name)
        {
            return res.status(400).json({message: 'Skill name is required'});
        }

        await query(`
            INSERT INTO user_skills 
            (user_id, skill_name, skill_category, proficiency_level, years_experience, verified_through)
            VALUES (?, ?, ?, ?, ?, 'self_declared')
            ON DUPLICATE KEY UPDATE
            skill_category = VALUES(skill_category),
            proficiency_level = VALUES(proficiency_level),
            years_experience = VALUES(years_experience),
            updated_at = NOW()
        `, [userId, skill_name, skill_category||'programming', proficiency_level||'intermediate', years_experience||0]);

        res.json({
            success: true,
            message: 'Skill added/updated successfully'
        });
    } catch (error)
    {
        console.error('Add skill error:', error);
        res.status(500).json({message: 'Failed to add skill', error: error.message});
    }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Update leaderboard stats for a user
 */
async function updateLeaderboardStats(userId)
{
    try
    {
        // Calculate aggregates from user_scores
        const [stats]=await query(`
            SELECT 
                SUM(score) as total_score,
                COUNT(*) as total_activities,
                AVG(percentage) as average_score,
                SUM(CASE WHEN activity_type IN ('coding_practice', 'challenge') THEN score ELSE 0 END) as coding_score,
                SUM(CASE WHEN activity_type IN ('coding_practice', 'challenge') THEN problems_solved ELSE 0 END) as coding_problems_solved,
                SUM(CASE WHEN activity_type IN ('ai_interview', 'live_interview') THEN score ELSE 0 END) as interview_score,
                COUNT(CASE WHEN activity_type IN ('ai_interview', 'live_interview') THEN 1 END) as interview_count,
                SUM(CASE WHEN activity_type = 'contest' THEN score ELSE 0 END) as contest_score,
                COUNT(CASE WHEN activity_type = 'contest' THEN 1 END) as contest_count,
                SUM(CASE WHEN activity_type = 'challenge' THEN score ELSE 0 END) as challenge_score,
                COUNT(CASE WHEN activity_type = 'challenge' THEN 1 END) as challenge_count,
                MAX(DATE(completed_at)) as last_activity_date
            FROM user_scores
            WHERE user_id = ?
        `, [userId]);

        if (!stats||stats.total_activities===0) return;

        // Calculate streak
        const streakInfo=await calculateStreak(userId);

        // Upsert leaderboard stats
        await query(`
            INSERT INTO user_leaderboard_stats 
            (user_id, total_score, total_activities, average_score, 
             coding_score, coding_problems_solved, interview_score, interview_count,
             contest_score, contest_count, challenge_score, challenge_count,
             current_streak_days, last_activity_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            total_score = VALUES(total_score),
            total_activities = VALUES(total_activities),
            average_score = VALUES(average_score),
            coding_score = VALUES(coding_score),
            coding_problems_solved = VALUES(coding_problems_solved),
            interview_score = VALUES(interview_score),
            interview_count = VALUES(interview_count),
            contest_score = VALUES(contest_score),
            contest_count = VALUES(contest_count),
            challenge_score = VALUES(challenge_score),
            challenge_count = VALUES(challenge_count),
            current_streak_days = VALUES(current_streak_days),
            last_activity_date = VALUES(last_activity_date),
            updated_at = NOW()
        `, [
            userId,
            stats.total_score||0,
            stats.total_activities||0,
            stats.average_score||0,
            stats.coding_score||0,
            stats.coding_problems_solved||0,
            stats.interview_score||0,
            stats.interview_count||0,
            stats.contest_score||0,
            stats.contest_count||0,
            stats.challenge_score||0,
            stats.challenge_count||0,
            streakInfo.current,
            stats.last_activity_date
        ]);

        // Update longest streak if current is longer
        await query(`
            UPDATE user_leaderboard_stats 
            SET longest_streak_days = GREATEST(longest_streak_days, current_streak_days)
            WHERE user_id = ?
        `, [userId]);

    } catch (error)
    {
        console.error('Update leaderboard stats error:', error);
    }
}

/**
 * Calculate user's activity streak
 */
async function calculateStreak(userId)
{
    try
    {
        // Get distinct activity dates
        const dates=await query(`
            SELECT DISTINCT DATE(completed_at) as activity_date
            FROM user_scores
            WHERE user_id = ?
            ORDER BY activity_date DESC
            LIMIT 365
        `, [userId]);

        if (!dates||dates.length===0)
        {
            return {current: 0, longest: 0};
        }

        let currentStreak=0;
        let today=new Date();
        today.setHours(0, 0, 0, 0);

        // Check if there's activity today or yesterday
        const firstDate=new Date(dates[0].activity_date);
        firstDate.setHours(0, 0, 0, 0);

        const daysDiff=Math.floor((today-firstDate)/(1000*60*60*24));

        if (daysDiff>1)
        {
            // No recent activity, streak is 0
            return {current: 0, longest: 0};
        }

        // Count consecutive days
        for (let i=0;i<dates.length-1;i++)
        {
            const current=new Date(dates[i].activity_date);
            const next=new Date(dates[i+1].activity_date);
            const diff=Math.floor((current-next)/(1000*60*60*24));

            if (diff===1)
            {
                currentStreak++;
            } else
            {
                break;
            }
        }

        currentStreak++; // Include the first day

        return {current: currentStreak, longest: currentStreak};
    } catch (error)
    {
        console.error('Calculate streak error:', error);
        return {current: 0, longest: 0};
    }
}

/**
 * Update user skills based on assessment
 */
async function updateUserSkills(userId, skills, scorePercentage)
{
    try
    {
        for (const skill of skills)
        {
            // Determine proficiency based on score
            let proficiency='beginner';
            if (scorePercentage>=90) proficiency='expert';
            else if (scorePercentage>=75) proficiency='advanced';
            else if (scorePercentage>=50) proficiency='intermediate';

            await query(`
                INSERT INTO user_skills 
                (user_id, skill_name, proficiency_level, score, verified, verified_through, last_assessed_at)
                VALUES (?, ?, ?, ?, TRUE, 'assessment', NOW())
                ON DUPLICATE KEY UPDATE
                score = GREATEST(score, VALUES(score)),
                proficiency_level = CASE 
                    WHEN VALUES(score) > score THEN VALUES(proficiency_level)
                    ELSE proficiency_level
                END,
                verified = TRUE,
                verified_through = 'assessment',
                last_assessed_at = NOW(),
                updated_at = NOW()
            `, [userId, skill, proficiency, scorePercentage]);
        }
    } catch (error)
    {
        console.error('Update user skills error:', error);
    }
}

export default router;
