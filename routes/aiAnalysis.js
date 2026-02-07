/**
 * AI Analysis Routes
 * Analyze user performance to identify strengths and weaknesses using AI
 */

import express from 'express';
import {query} from '../db/database.js';
import groqAI from '../services/geminiAI.js';

const router=express.Router();

/**
 * Get or generate AI analysis for user
 * GET /api/ai-analysis/:userId
 */
router.get('/:userId', async (req, res) =>
{
    try
    {
        const {userId}=req.params;
        const {refresh=false}=req.query;

        // Check for existing valid analysis
        if (!refresh)
        {
            const [existing]=await query(`
                SELECT * FROM user_ai_analysis
                WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY analyzed_at DESC
                LIMIT 1
            `, [userId]);

            if (existing)
            {
                return res.json({
                    success: true,
                    analysis: {
                        ...existing,
                        strengths: existing.strengths? JSON.parse(existing.strengths):[],
                        weaknesses: existing.weaknesses? JSON.parse(existing.weaknesses):[],
                        skill_radar: existing.skill_radar? JSON.parse(existing.skill_radar):{},
                        recommended_topics: existing.recommended_topics? JSON.parse(existing.recommended_topics):[],
                        recommended_jobs: existing.recommended_jobs? JSON.parse(existing.recommended_jobs):[]
                    },
                    cached: true
                });
            }
        }

        // Generate new analysis
        const analysis=await generateUserAnalysis(userId);

        res.json({
            success: true,
            analysis,
            cached: false
        });
    } catch (error)
    {
        console.error('Get AI analysis error:', error);
        res.status(500).json({message: 'Failed to get analysis', error: error.message});
    }
});

/**
 * Force refresh AI analysis
 * POST /api/ai-analysis/:userId/refresh
 */
router.post('/:userId/refresh', async (req, res) =>
{
    try
    {
        const {userId}=req.params;

        const analysis=await generateUserAnalysis(userId);

        res.json({
            success: true,
            analysis,
            message: 'Analysis refreshed successfully'
        });
    } catch (error)
    {
        console.error('Refresh AI analysis error:', error);
        res.status(500).json({message: 'Failed to refresh analysis', error: error.message});
    }
});

/**
 * Get skill recommendations based on job requirements
 * POST /api/ai-analysis/:userId/job-match
 */
router.post('/:userId/job-match', async (req, res) =>
{
    try
    {
        const {userId}=req.params;
        const {jobId}=req.body;

        // Get user data
        const [user]=await query('SELECT * FROM users WHERE id = ?', [userId]);
        const userSkills=await query('SELECT * FROM user_skills WHERE user_id = ?', [userId]);
        const [stats]=await query('SELECT * FROM user_leaderboard_stats WHERE user_id = ?', [userId]);

        // Get job requirements
        const [job]=await query('SELECT * FROM jobs WHERE id = ?', [jobId]);
        if (!job)
        {
            return res.status(404).json({message: 'Job not found'});
        }

        const requiredSkills=job.skills_required_json? JSON.parse(job.skills_required_json):[];
        const preferredSkills=job.skills_preferred_json? JSON.parse(job.skills_preferred_json):[];

        // Analyze gap
        const userSkillNames=userSkills.map(s => s.skill_name.toLowerCase());

        const missingRequired=requiredSkills.filter(s => !userSkillNames.includes(s.toLowerCase()));
        const missingPreferred=preferredSkills.filter(s => !userSkillNames.includes(s.toLowerCase()));
        const matchedRequired=requiredSkills.filter(s => userSkillNames.includes(s.toLowerCase()));
        const matchedPreferred=preferredSkills.filter(s => userSkillNames.includes(s.toLowerCase()));

        // Calculate match percentage
        const requiredMatch=requiredSkills.length>0
            ? (matchedRequired.length/requiredSkills.length)*100
            :100;
        const preferredMatch=preferredSkills.length>0
            ? (matchedPreferred.length/preferredSkills.length)*100
            :100;
        const overallMatch=(requiredMatch*0.7)+(preferredMatch*0.3);

        // Generate AI recommendation
        const prompt=`
        Analyze this job match and provide brief recommendations:
        
        Job: ${job.title}
        Required Skills: ${requiredSkills.join(', ')}
        Preferred Skills: ${preferredSkills.join(', ')}
        
        User's Skills: ${userSkills.map(s => `${s.skill_name} (${s.proficiency_level})`).join(', ')}
        User's Platform Score: ${stats?.average_score||0}
        
        Missing Required: ${missingRequired.join(', ')||'None'}
        Missing Preferred: ${missingPreferred.join(', ')||'None'}
        
        Provide:
        1. A brief assessment of fit (2 sentences)
        2. Top 3 skills to focus on improving
        3. Estimated time to become job-ready
        
        Keep response under 200 words.`;

        const aiRecommendation=await groqAI.generateResponse(
            [{role: 'user', content: prompt}],
            'You are a career advisor helping candidates improve their job readiness.'
        );

        res.json({
            success: true,
            match: {
                overall_percentage: Math.round(overallMatch),
                required_match: Math.round(requiredMatch),
                preferred_match: Math.round(preferredMatch),
                matched_required: matchedRequired,
                matched_preferred: matchedPreferred,
                missing_required: missingRequired,
                missing_preferred: missingPreferred
            },
            job: {
                id: job.id,
                title: job.title,
                company_id: job.company_id
            },
            recommendation: aiRecommendation
        });
    } catch (error)
    {
        console.error('Job match analysis error:', error);
        res.status(500).json({message: 'Failed to analyze job match', error: error.message});
    }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate comprehensive AI analysis for a user
 */
async function generateUserAnalysis(userId)
{
    try
    {
        // Gather user data
        const [user]=await query('SELECT * FROM users WHERE id = ?', [userId]);
        const skills=await query('SELECT * FROM user_skills WHERE user_id = ? ORDER BY score DESC', [userId]);
        const [stats]=await query('SELECT * FROM user_leaderboard_stats WHERE user_id = ?', [userId]);

        // Get recent scores with details
        const recentScores=await query(`
            SELECT * FROM user_scores 
            WHERE user_id = ? 
            ORDER BY completed_at DESC 
            LIMIT 50
        `, [userId]);

        // Get score trends by category
        const categoryStats=await query(`
            SELECT 
                activity_type,
                AVG(percentage) as avg_score,
                COUNT(*) as count,
                MIN(percentage) as min_score,
                MAX(percentage) as max_score
            FROM user_scores
            WHERE user_id = ?
            GROUP BY activity_type
        `, [userId]);

        // Build analysis prompt
        const analysisPrompt=buildAnalysisPrompt(user, skills, stats, recentScores, categoryStats);

        // Generate AI analysis
        const aiResponse=await groqAI.generateResponse(
            [{role: 'user', content: analysisPrompt}],
            `You are an expert career coach and technical interviewer. Analyze the candidate's performance data and provide actionable insights.
            
            IMPORTANT: Return your analysis in the following JSON format:
            {
                "strengths": [{"skill": "skill_name", "confidence": 0.85, "evidence": "explanation"}],
                "weaknesses": [{"skill": "skill_name", "confidence": 0.75, "suggestions": ["tip1", "tip2"]}],
                "overall_assessment": "2-3 sentence summary",
                "coding_analysis": "analysis of coding skills",
                "interview_analysis": "analysis of interview skills",
                "communication_analysis": "analysis of communication skills",
                "skill_radar": {"problem_solving": 80, "communication": 70, "technical_depth": 75, "code_quality": 85, "speed": 65},
                "recommended_topics": ["topic1", "topic2", "topic3"],
                "recommended_jobs": ["job_type1", "job_type2"],
                "improvement_plan": "Step-by-step improvement plan"
            }`
        );

        // Parse AI response
        let parsedAnalysis;
        try
        {
            // Extract JSON from response
            const jsonMatch=aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch)
            {
                parsedAnalysis=JSON.parse(jsonMatch[0]);
            } else
            {
                parsedAnalysis=generateDefaultAnalysis(skills, stats, categoryStats);
            }
        } catch (parseError)
        {
            console.error('Failed to parse AI response, using fallback:', parseError);
            parsedAnalysis=generateDefaultAnalysis(skills, stats, categoryStats);
        }

        // Store analysis in database
        const result=await query(`
            INSERT INTO user_ai_analysis 
            (user_id, strengths, weaknesses, overall_assessment, coding_analysis, 
             interview_analysis, communication_analysis, skill_radar, recommended_topics, 
             recommended_jobs, improvement_plan, analysis_confidence, data_points_used, 
             expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
            ON DUPLICATE KEY UPDATE
            strengths = VALUES(strengths),
            weaknesses = VALUES(weaknesses),
            overall_assessment = VALUES(overall_assessment),
            coding_analysis = VALUES(coding_analysis),
            interview_analysis = VALUES(interview_analysis),
            communication_analysis = VALUES(communication_analysis),
            skill_radar = VALUES(skill_radar),
            recommended_topics = VALUES(recommended_topics),
            recommended_jobs = VALUES(recommended_jobs),
            improvement_plan = VALUES(improvement_plan),
            analysis_confidence = VALUES(analysis_confidence),
            data_points_used = VALUES(data_points_used),
            analyzed_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY),
            updated_at = NOW()
        `, [
            userId,
            JSON.stringify(parsedAnalysis.strengths||[]),
            JSON.stringify(parsedAnalysis.weaknesses||[]),
            parsedAnalysis.overall_assessment||'',
            parsedAnalysis.coding_analysis||'',
            parsedAnalysis.interview_analysis||'',
            parsedAnalysis.communication_analysis||'',
            JSON.stringify(parsedAnalysis.skill_radar||{}),
            JSON.stringify(parsedAnalysis.recommended_topics||[]),
            JSON.stringify(parsedAnalysis.recommended_jobs||[]),
            parsedAnalysis.improvement_plan||'',
            0.8,
            recentScores.length
        ]);

        return {
            id: result.insertId,
            user_id: userId,
            ...parsedAnalysis,
            data_points_used: recentScores.length,
            analyzed_at: new Date().toISOString()
        };
    } catch (error)
    {
        console.error('Generate analysis error:', error);
        throw error;
    }
}

/**
 * Build prompt for AI analysis
 */
function buildAnalysisPrompt(user, skills, stats, recentScores, categoryStats)
{
    const skillsSummary=skills.length>0
        ? skills.map(s => `${s.skill_name}: ${s.proficiency_level} (Score: ${s.score||'N/A'})`).join('\n')
        :'No skills recorded';

    const categorySummary=categoryStats.map(c =>
        `${c.activity_type}: ${c.count} activities, Avg Score: ${Math.round(c.avg_score)}%, Range: ${Math.round(c.min_score)}-${Math.round(c.max_score)}%`
    ).join('\n');

    const recentActivity=recentScores.slice(0, 10).map(s =>
        `${s.activity_type}: ${s.activity_title||'Activity'} - Score: ${s.percentage}%`
    ).join('\n');

    return `
Analyze this candidate's performance data and provide insights:

USER PROFILE:
Name: ${user?.full_name||user?.username||'Anonymous'}
Experience: ${user?.experience_years||0} years

SKILLS:
${skillsSummary}

OVERALL STATS:
Total Score: ${stats?.total_score||0}
Activities Completed: ${stats?.total_activities||0}
Average Score: ${stats?.average_score||0}%
Coding Problems Solved: ${stats?.coding_problems_solved||0}
Interviews Completed: ${stats?.interview_count||0}
Current Streak: ${stats?.current_streak_days||0} days

PERFORMANCE BY CATEGORY:
${categorySummary||'No category data'}

RECENT ACTIVITY:
${recentActivity||'No recent activity'}

Based on this data, provide:
1. Top 3-5 strengths with evidence
2. Top 3-5 weaknesses with improvement suggestions
3. Overall assessment
4. Skill radar scores (0-100) for: problem_solving, communication, technical_depth, code_quality, speed
5. Recommended topics to study
6. Job types that match this profile
7. A brief improvement plan

Return your analysis as JSON.`;
}

/**
 * Generate default analysis when AI fails
 */
function generateDefaultAnalysis(skills, stats, categoryStats)
{
    const topSkills=skills.slice(0, 3);
    const weakSkills=skills.slice(-3).reverse();

    const strengths=topSkills.map(s => ({
        skill: s.skill_name,
        confidence: 0.7,
        evidence: `Demonstrated ${s.proficiency_level} level proficiency`
    }));

    const weaknesses=weakSkills.length>0? weakSkills.map(s => ({
        skill: s.skill_name,
        confidence: 0.6,
        suggestions: ['Practice more problems', 'Take online courses', 'Work on projects']
    })):[{
        skill: 'Practice consistency',
        confidence: 0.5,
        suggestions: ['Complete more activities', 'Maintain a daily practice streak']
    }];

    // Calculate skill radar based on available data
    const codingStats=categoryStats.find(c => c.activity_type==='coding_practice');
    const interviewStats=categoryStats.find(c => c.activity_type==='ai_interview');

    return {
        strengths,
        weaknesses,
        overall_assessment: `Based on ${stats?.total_activities||0} activities with an average score of ${Math.round(stats?.average_score||0)}%. ${stats?.total_activities>10? 'Good practice consistency.':'More practice recommended.'}`,
        coding_analysis: codingStats
            ? `Coding average: ${Math.round(codingStats.avg_score)}% across ${codingStats.count} problems.`
            :'Limited coding practice data available.',
        interview_analysis: interviewStats
            ? `Interview average: ${Math.round(interviewStats.avg_score)}% across ${interviewStats.count} sessions.`
            :'No interview data available yet.',
        communication_analysis: 'Communicate clearly during interviews and code reviews.',
        skill_radar: {
            problem_solving: Math.round(stats?.average_score||50),
            communication: 60,
            technical_depth: Math.round((codingStats?.avg_score||50)),
            code_quality: 65,
            speed: 55
        },
        recommended_topics: ['Data Structures', 'Algorithms', 'System Design'],
        recommended_jobs: ['Software Developer', 'Frontend Developer', 'Backend Developer'],
        improvement_plan: '1. Practice daily coding problems\n2. Complete mock interviews\n3. Build portfolio projects\n4. Learn system design concepts'
    };
}

export default router;
