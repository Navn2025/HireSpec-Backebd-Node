/**
 * Badges & Achievements Routes
 * Handle badge awards, achievement tracking, and user rewards
 */

import express from 'express';
import { query } from '../db/database.js';

const router = express.Router();

// Define available badges
const BADGES = {
    // Activity Badges
    first_blood: {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Complete your first coding challenge',
        icon: '🎯',
        category: 'activity',
        points: 10
    },
    problem_solver: {
        id: 'problem_solver',
        name: 'Problem Solver',
        description: 'Solve 10 coding problems',
        icon: '🧠',
        category: 'activity',
        points: 50,
        requirement: 10
    },
    coding_master: {
        id: 'coding_master',
        name: 'Coding Master',
        description: 'Solve 50 coding problems',
        icon: '💻',
        category: 'activity',
        points: 200,
        requirement: 50
    },
    algorithm_guru: {
        id: 'algorithm_guru',
        name: 'Algorithm Guru',
        description: 'Solve 100 coding problems',
        icon: '🔮',
        category: 'activity',
        points: 500,
        requirement: 100
    },
    
    // Speed Badges
    speed_demon: {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Solve a problem in under 5 minutes',
        icon: '⚡',
        category: 'speed',
        points: 25
    },
    lightning_fast: {
        id: 'lightning_fast',
        name: 'Lightning Fast',
        description: 'Solve a medium problem in under 10 minutes',
        icon: '🌩️',
        category: 'speed',
        points: 50
    },
    
    // Streak Badges
    streak_starter: {
        id: 'streak_starter',
        name: 'Streak Starter',
        description: 'Maintain a 3-day streak',
        icon: '🔥',
        category: 'streak',
        points: 15,
        requirement: 3
    },
    streak_warrior: {
        id: 'streak_warrior',
        name: 'Streak Warrior',
        description: 'Maintain a 7-day streak',
        icon: '🔥',
        category: 'streak',
        points: 50,
        requirement: 7
    },
    streak_champion: {
        id: 'streak_champion',
        name: 'Streak Champion',
        description: 'Maintain a 30-day streak',
        icon: '👑',
        category: 'streak',
        points: 200,
        requirement: 30
    },
    
    // Rank Badges
    top_100: {
        id: 'top_100',
        name: 'Top 100',
        description: 'Reach top 100 in global leaderboard',
        icon: '🥉',
        category: 'rank',
        points: 100
    },
    top_10: {
        id: 'top_10',
        name: 'Top 10',
        description: 'Reach top 10 in global leaderboard',
        icon: '🏆',
        category: 'rank',
        points: 500
    },
    number_one: {
        id: 'number_one',
        name: 'Number One',
        description: 'Reach #1 in global leaderboard',
        icon: '👑',
        category: 'rank',
        points: 1000
    },
    
    // Score Badges
    perfect_score: {
        id: 'perfect_score',
        name: 'Perfect Score',
        description: 'Get 100% on any assessment',
        icon: '💯',
        category: 'score',
        points: 75
    },
    high_achiever: {
        id: 'high_achiever',
        name: 'High Achiever',
        description: 'Score above 90% on 5 assessments',
        icon: '⭐',
        category: 'score',
        points: 100,
        requirement: 5
    },
    
    // Interview Badges
    interview_starter: {
        id: 'interview_starter',
        name: 'Interview Starter',
        description: 'Complete your first AI interview',
        icon: '🎤',
        category: 'interview',
        points: 20
    },
    interview_master: {
        id: 'interview_master',
        name: 'Interview Master',
        description: 'Complete 10 AI interviews',
        icon: '🎙️',
        category: 'interview',
        points: 100,
        requirement: 10
    },
    interview_ace: {
        id: 'interview_ace',
        name: 'Interview Ace',
        description: 'Score above 85% on 5 interviews',
        icon: '🌟',
        category: 'interview',
        points: 150,
        requirement: 5
    },
    
    // Contest Badges
    contest_participant: {
        id: 'contest_participant',
        name: 'Contest Participant',
        description: 'Participate in your first contest',
        icon: '🏅',
        category: 'contest',
        points: 25
    },
    contest_winner: {
        id: 'contest_winner',
        name: 'Contest Winner',
        description: 'Win a coding contest',
        icon: '🏆',
        category: 'contest',
        points: 300
    },
    
    // Time Badges
    early_bird: {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Complete a challenge before 6 AM',
        icon: '🌅',
        category: 'time',
        points: 15
    },
    night_owl: {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Complete a challenge after midnight',
        icon: '🦉',
        category: 'time',
        points: 15
    },
    
    // Special Badges
    rising_star: {
        id: 'rising_star',
        name: 'Rising Star',
        description: 'Improve your rank by 50 positions in a week',
        icon: '⭐',
        category: 'special',
        points: 75
    },
    hard_worker: {
        id: 'hard_worker',
        name: 'Hard Worker',
        description: 'Solve 3 hard problems',
        icon: '💪',
        category: 'difficulty',
        points: 100,
        requirement: 3
    }
};

// ==================== BADGE LISTING ====================

/**
 * Get all available badges
 * GET /api/badges
 */
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        
        let badges = Object.values(BADGES);
        
        if (category) {
            badges = badges.filter(b => b.category === category);
        }
        
        res.json({
            success: true,
            badges,
            categories: [...new Set(Object.values(BADGES).map(b => b.category))]
        });
    } catch (error) {
        console.error('Get badges error:', error);
        res.status(500).json({ message: 'Failed to fetch badges', error: error.message });
    }
});

/**
 * Get user's earned badges
 * GET /api/badges/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get user's leaderboard stats which contains badges
        const [stats] = await query(`
            SELECT badges, achievements FROM user_leaderboard_stats WHERE user_id = ?
        `, [userId]);
        
        const userBadges = stats?.badges ? JSON.parse(stats.badges) : [];
        const achievements = stats?.achievements ? JSON.parse(stats.achievements) : [];
        
        // Enrich with badge details
        const enrichedBadges = userBadges.map(badgeId => ({
            ...BADGES[badgeId],
            earned: true,
            earned_at: achievements.find(a => a.badge_id === badgeId)?.earned_at || null
        }));
        
        // Get all badges with earned status
        const allBadges = Object.values(BADGES).map(badge => ({
            ...badge,
            earned: userBadges.includes(badge.id)
        }));
        
        // Calculate total points
        const totalPoints = enrichedBadges.reduce((sum, b) => sum + (b.points || 0), 0);
        
        res.json({
            success: true,
            earnedBadges: enrichedBadges,
            allBadges,
            totalPoints,
            badgeCount: enrichedBadges.length,
            totalBadges: Object.keys(BADGES).length
        });
    } catch (error) {
        console.error('Get user badges error:', error);
        res.status(500).json({ message: 'Failed to fetch user badges', error: error.message });
    }
});

// ==================== BADGE AWARDING ====================

/**
 * Award a badge to a user
 * POST /api/badges/award
 */
router.post('/award', async (req, res) => {
    try {
        const { userId, badgeId, reason } = req.body;
        
        if (!userId || !badgeId) {
            return res.status(400).json({ message: 'userId and badgeId are required' });
        }
        
        if (!BADGES[badgeId]) {
            return res.status(400).json({ message: 'Invalid badge ID' });
        }
        
        // Get current badges
        const [stats] = await query(`
            SELECT badges, achievements FROM user_leaderboard_stats WHERE user_id = ?
        `, [userId]);
        
        let currentBadges = stats?.badges ? JSON.parse(stats.badges) : [];
        let achievements = stats?.achievements ? JSON.parse(stats.achievements) : [];
        
        // Check if already awarded
        if (currentBadges.includes(badgeId)) {
            return res.json({
                success: true,
                message: 'Badge already awarded',
                alreadyEarned: true
            });
        }
        
        // Add badge
        currentBadges.push(badgeId);
        achievements.push({
            badge_id: badgeId,
            earned_at: new Date().toISOString(),
            reason: reason || 'Achievement unlocked'
        });
        
        // Update database
        await query(`
            INSERT INTO user_leaderboard_stats (user_id, badges, achievements)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
            badges = VALUES(badges),
            achievements = VALUES(achievements),
            updated_at = NOW()
        `, [userId, JSON.stringify(currentBadges), JSON.stringify(achievements)]);
        
        res.json({
            success: true,
            message: 'Badge awarded successfully',
            badge: BADGES[badgeId]
        });
    } catch (error) {
        console.error('Award badge error:', error);
        res.status(500).json({ message: 'Failed to award badge', error: error.message });
    }
});

/**
 * Check and award badges based on user activity
 * POST /api/badges/check/:userId
 */
router.post('/check/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const awardedBadges = [];
        
        // Get user stats
        const [stats] = await query(`
            SELECT * FROM user_leaderboard_stats WHERE user_id = ?
        `, [userId]);
        
        let currentBadges = stats?.badges ? JSON.parse(stats.badges) : [];
        let achievements = stats?.achievements ? JSON.parse(stats.achievements) : [];
        
        // Check problem count badges
        const problemsSolved = stats?.coding_problems_solved || 0;
        
        if (problemsSolved >= 1 && !currentBadges.includes('first_blood')) {
            currentBadges.push('first_blood');
            achievements.push({ badge_id: 'first_blood', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.first_blood);
        }
        
        if (problemsSolved >= 10 && !currentBadges.includes('problem_solver')) {
            currentBadges.push('problem_solver');
            achievements.push({ badge_id: 'problem_solver', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.problem_solver);
        }
        
        if (problemsSolved >= 50 && !currentBadges.includes('coding_master')) {
            currentBadges.push('coding_master');
            achievements.push({ badge_id: 'coding_master', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.coding_master);
        }
        
        // Check streak badges
        const streak = stats?.current_streak_days || 0;
        
        if (streak >= 3 && !currentBadges.includes('streak_starter')) {
            currentBadges.push('streak_starter');
            achievements.push({ badge_id: 'streak_starter', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.streak_starter);
        }
        
        if (streak >= 7 && !currentBadges.includes('streak_warrior')) {
            currentBadges.push('streak_warrior');
            achievements.push({ badge_id: 'streak_warrior', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.streak_warrior);
        }
        
        if (streak >= 30 && !currentBadges.includes('streak_champion')) {
            currentBadges.push('streak_champion');
            achievements.push({ badge_id: 'streak_champion', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.streak_champion);
        }
        
        // Check interview badges
        const interviewCount = stats?.interview_count || 0;
        
        if (interviewCount >= 1 && !currentBadges.includes('interview_starter')) {
            currentBadges.push('interview_starter');
            achievements.push({ badge_id: 'interview_starter', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.interview_starter);
        }
        
        if (interviewCount >= 10 && !currentBadges.includes('interview_master')) {
            currentBadges.push('interview_master');
            achievements.push({ badge_id: 'interview_master', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.interview_master);
        }
        
        // Check contest badges
        const contestCount = stats?.contest_count || 0;
        
        if (contestCount >= 1 && !currentBadges.includes('contest_participant')) {
            currentBadges.push('contest_participant');
            achievements.push({ badge_id: 'contest_participant', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.contest_participant);
        }
        
        // Check rank badges
        const globalRank = stats?.global_rank || 999999;
        
        if (globalRank <= 100 && !currentBadges.includes('top_100')) {
            currentBadges.push('top_100');
            achievements.push({ badge_id: 'top_100', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.top_100);
        }
        
        if (globalRank <= 10 && !currentBadges.includes('top_10')) {
            currentBadges.push('top_10');
            achievements.push({ badge_id: 'top_10', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.top_10);
        }
        
        if (globalRank === 1 && !currentBadges.includes('number_one')) {
            currentBadges.push('number_one');
            achievements.push({ badge_id: 'number_one', earned_at: new Date().toISOString() });
            awardedBadges.push(BADGES.number_one);
        }
        
        // Update if new badges earned
        if (awardedBadges.length > 0) {
            await query(`
                UPDATE user_leaderboard_stats 
                SET badges = ?, achievements = ?, updated_at = NOW()
                WHERE user_id = ?
            `, [JSON.stringify(currentBadges), JSON.stringify(achievements), userId]);
        }
        
        res.json({
            success: true,
            newBadges: awardedBadges,
            totalBadges: currentBadges.length
        });
    } catch (error) {
        console.error('Check badges error:', error);
        res.status(500).json({ message: 'Failed to check badges', error: error.message });
    }
});

// ==================== LEADERBOARD BY BADGES ====================

/**
 * Get badge leaderboard (users sorted by badge count)
 * GET /api/badges/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const leaderboard = await query(`
            SELECT 
                u.id as user_id,
                u.username,
                u.full_name,
                u.profile_image,
                ls.badges,
                JSON_LENGTH(COALESCE(ls.badges, '[]')) as badge_count
            FROM users u
            LEFT JOIN user_leaderboard_stats ls ON u.id = ls.user_id
            WHERE u.role = 'candidate'
            HAVING badge_count > 0
            ORDER BY badge_count DESC
            LIMIT ?
        `, [parseInt(limit)]);
        
        const enrichedLeaderboard = leaderboard.map((entry, index) => {
            const badgeIds = entry.badges ? JSON.parse(entry.badges) : [];
            return {
                rank: index + 1,
                user_id: entry.user_id,
                username: entry.username,
                full_name: entry.full_name,
                profile_image: entry.profile_image,
                badge_count: entry.badge_count,
                badges: badgeIds.slice(0, 5).map(id => BADGES[id]).filter(Boolean),
                total_points: badgeIds.reduce((sum, id) => sum + (BADGES[id]?.points || 0), 0)
            };
        });
        
        res.json({
            success: true,
            leaderboard: enrichedLeaderboard
        });
    } catch (error) {
        console.error('Get badge leaderboard error:', error);
        res.status(500).json({ message: 'Failed to fetch badge leaderboard', error: error.message });
    }
});

export default router;
