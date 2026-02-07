/**
 * Candidate Filtering Service
 * Advanced filtering and ranking of candidates for companies
 */

import {query} from '../db/database.js';
import {calculateATSScore, rankCandidates} from './resumeParser.js';

/**
 * Filter candidates by multiple criteria
 */
export async function filterCandidates(filters)
{
    const {
        job_id,
        company_id,
        min_ats_score,
        max_ats_score,
        skills,
        min_experience,
        max_experience,
        education_level,
        location,
        status,
        sort_by='ats_score',
        sort_order='DESC',
        page=1,
        limit=20
    }=filters;

    let whereConditions=['1=1'];
    let params=[];

    // Base query with joins
    let sql=`
        SELECT DISTINCT
            u.id as user_id,
            u.username,
            u.email,
            u.phone,
            u.location as user_location,
            u.linkedin_url,
            u.github_url,
            u.experience_years,
            u.skills as user_skills,
            cr.parsed_data_json,
            cr.extracted_skills_json,
            cr.experience_years as resume_experience,
            app.id as application_id,
            app.status as application_status,
            app.applied_at,
            ats.overall_score as ats_score,
            ats.breakdown_json as ats_breakdown,
            ats.matched_skills_json,
            ats.missing_skills_json,
            j.id as job_id,
            j.title as job_title,
            c.name as company_name
        FROM users u
        LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
        LEFT JOIN applications app ON u.id = app.candidate_user_id
        LEFT JOIN jobs j ON app.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN ats_scores ats ON u.id = ats.user_id AND ats.job_id = j.id
        WHERE u.role = 'candidate'
    `;

    // Filter by job
    if (job_id)
    {
        whereConditions.push('app.job_id = ?');
        params.push(job_id);
    }

    // Filter by company
    if (company_id)
    {
        whereConditions.push('j.company_id = ?');
        params.push(company_id);
    }

    // Filter by ATS score range
    if (min_ats_score!==undefined)
    {
        whereConditions.push('ats.overall_score >= ?');
        params.push(min_ats_score);
    }
    if (max_ats_score!==undefined)
    {
        whereConditions.push('ats.overall_score <= ?');
        params.push(max_ats_score);
    }

    // Filter by skills (JSON search)
    if (skills&&skills.length>0)
    {
        const skillConditions=skills.map(() =>
            `(cr.extracted_skills_json LIKE ? OR u.skills LIKE ?)`
        );
        whereConditions.push(`(${skillConditions.join(' OR ')})`);
        skills.forEach(skill =>
        {
            params.push(`%${skill}%`);
            params.push(`%${skill}%`);
        });
    }

    // Filter by experience
    if (min_experience!==undefined)
    {
        whereConditions.push('(cr.experience_years >= ? OR u.experience_years >= ?)');
        params.push(min_experience, min_experience);
    }
    if (max_experience!==undefined)
    {
        whereConditions.push('(cr.experience_years <= ? OR u.experience_years <= ?)');
        params.push(max_experience, max_experience);
    }

    // Filter by education level
    if (education_level)
    {
        whereConditions.push('cr.parsed_data_json LIKE ?');
        params.push(`%${education_level}%`);
    }

    // Filter by location
    if (location)
    {
        whereConditions.push('(u.location LIKE ? OR cr.parsed_data_json LIKE ?)');
        params.push(`%${location}%`, `%${location}%`);
    }

    // Filter by application status
    if (status)
    {
        if (Array.isArray(status))
        {
            whereConditions.push(`app.status IN (${status.map(() => '?').join(',')})`);
            params.push(...status);
        } else
        {
            whereConditions.push('app.status = ?');
            params.push(status);
        }
    }

    sql+=` AND ${whereConditions.join(' AND ')}`;

    // Sorting
    const validSortColumns={
        'ats_score': 'ats.overall_score',
        'experience': 'cr.experience_years',
        'applied_at': 'app.applied_at',
        'name': 'u.username'
    };
    const sortColumn=validSortColumns[sort_by]||'ats.overall_score';
    const order=sort_order.toUpperCase()==='ASC'? 'ASC':'DESC';
    sql+=` ORDER BY ${sortColumn} ${order}`;

    // Pagination
    const offset=(page-1)*limit;
    sql+=` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const candidates=await query(sql, params);

    // Get total count
    const countSql=`
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
        LEFT JOIN applications app ON u.id = app.candidate_user_id
        LEFT JOIN jobs j ON app.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN ats_scores ats ON u.id = ats.user_id AND ats.job_id = j.id
        WHERE u.role = 'candidate' AND ${whereConditions.join(' AND ')}
    `;
    const countResult=await query(countSql, params.slice(0, -2)); // Remove limit/offset params

    // Parse JSON fields
    const parsedCandidates=candidates.map(c => ({
        ...c,
        parsed_resume: c.parsed_data_json? JSON.parse(c.parsed_data_json):null,
        extracted_skills: c.extracted_skills_json? JSON.parse(c.extracted_skills_json):[],
        user_skills: c.user_skills? JSON.parse(c.user_skills):[],
        ats_breakdown: c.ats_breakdown? JSON.parse(c.ats_breakdown):null,
        matched_skills: c.matched_skills_json? JSON.parse(c.matched_skills_json):[],
        missing_skills: c.missing_skills_json? JSON.parse(c.missing_skills_json):[]
    }));

    return {
        candidates: parsedCandidates,
        pagination: {
            page,
            limit,
            total: countResult[0]?.total||0,
            total_pages: Math.ceil((countResult[0]?.total||0)/limit)
        }
    };
}

/**
 * Get top candidates for a job
 */
export async function getTopCandidates(job_id, limit=10)
{
    // Get job requirements
    const [jobResult]=await query(
        `SELECT j.*, c.name as company_name 
         FROM jobs j 
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE j.id = ?`,
        [job_id]
    );

    if (!jobResult.length)
    {
        throw new Error('Job not found');
    }

    const job=jobResult[0];
    const jobSkills=job.skills_json? JSON.parse(job.skills_json):{};

    // Get all candidates who applied
    const candidates=await query(
        `SELECT 
            u.id as user_id,
            u.username,
            u.email,
            u.experience_years,
            cr.parsed_data_json,
            cr.extracted_skills_json,
            app.id as application_id,
            app.status,
            ats.overall_score,
            ats.breakdown_json
         FROM applications app
         JOIN users u ON app.candidate_user_id = u.id
         LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
         LEFT JOIN ats_scores ats ON u.id = ats.user_id AND ats.job_id = ?
         WHERE app.job_id = ?
         ORDER BY ats.overall_score DESC
         LIMIT ?`,
        [job_id, job_id, limit]
    );

    // Parse and enhance candidate data
    const enhancedCandidates=candidates.map(c =>
    {
        const parsedResume=c.parsed_data_json? JSON.parse(c.parsed_data_json):null;
        const breakdown=c.breakdown_json? JSON.parse(c.breakdown_json):null;

        return {
            user_id: c.user_id,
            username: c.username,
            email: c.email,
            experience_years: c.experience_years||parsedResume?.total_experience_years||0,
            application_id: c.application_id,
            status: c.status,
            ats_score: c.overall_score||0,
            ats_breakdown: breakdown,
            skills: c.extracted_skills_json? JSON.parse(c.extracted_skills_json):[],
            match_summary: generateMatchSummary(parsedResume, jobSkills, breakdown)
        };
    });

    return {
        job: {
            id: job.id,
            title: job.title,
            company: job.company_name,
            required_skills: jobSkills.required||[],
            preferred_skills: jobSkills.preferred||[]
        },
        top_candidates: enhancedCandidates,
        statistics: {
            total_applicants: enhancedCandidates.length,
            avg_ats_score: calculateAverage(enhancedCandidates.map(c => c.ats_score)),
            skill_coverage: calculateSkillCoverage(enhancedCandidates, jobSkills)
        }
    };
}

/**
 * Get candidate comparison for a job
 */
export async function compareCandidates(candidate_ids, job_id)
{
    // Get job requirements
    const [jobResult]=await query(
        `SELECT * FROM jobs WHERE id = ?`,
        [job_id]
    );

    if (!jobResult.length)
    {
        throw new Error('Job not found');
    }

    const job=jobResult[0];
    const jobSkills=job.skills_json? JSON.parse(job.skills_json):{};

    // Get candidate details
    const placeholders=candidate_ids.map(() => '?').join(',');
    const candidates=await query(
        `SELECT 
            u.id as user_id,
            u.username,
            u.email,
            u.experience_years,
            u.linkedin_url,
            u.github_url,
            cr.parsed_data_json,
            cr.extracted_skills_json,
            ats.overall_score,
            ats.breakdown_json,
            ats.matched_skills_json,
            ats.missing_skills_json,
            (SELECT COUNT(*) FROM coding_submissions cs 
             JOIN coding_sessions s ON cs.session_id = s.id 
             WHERE s.user_id = u.id AND cs.status = 'accepted') as coding_success_count,
            (SELECT AVG(ir.overall_rating) FROM interview_results ir 
             WHERE ir.candidate_user_id = u.id) as avg_interview_rating
         FROM users u
         LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
         LEFT JOIN ats_scores ats ON u.id = ats.user_id AND ats.job_id = ?
         WHERE u.id IN (${placeholders})`,
        [job_id, ...candidate_ids]
    );

    // Build comparison matrix
    const comparison=candidates.map(c =>
    {
        const parsedResume=c.parsed_data_json? JSON.parse(c.parsed_data_json):null;
        const breakdown=c.breakdown_json? JSON.parse(c.breakdown_json):null;

        return {
            user_id: c.user_id,
            username: c.username,
            email: c.email,
            metrics: {
                ats_score: c.overall_score||0,
                experience_years: c.experience_years||parsedResume?.total_experience_years||0,
                coding_problems_solved: c.coding_success_count||0,
                interview_rating: c.avg_interview_rating||null,
                skills_match: breakdown?.skills_match||0,
                education_match: breakdown?.education_match||0
            },
            skills: {
                matched: c.matched_skills_json? JSON.parse(c.matched_skills_json):[],
                missing: c.missing_skills_json? JSON.parse(c.missing_skills_json):[],
                all: c.extracted_skills_json? JSON.parse(c.extracted_skills_json):[]
            },
            profile: {
                linkedin: c.linkedin_url,
                github: c.github_url,
                summary: parsedResume?.summary||null
            }
        };
    });

    // Calculate rankings
    const rankings={
        by_ats: [...comparison].sort((a, b) => b.metrics.ats_score-a.metrics.ats_score),
        by_experience: [...comparison].sort((a, b) => b.metrics.experience_years-a.metrics.experience_years),
        by_coding: [...comparison].sort((a, b) => b.metrics.coding_problems_solved-a.metrics.coding_problems_solved)
    };

    return {
        job,
        candidates: comparison,
        rankings,
        recommendation: generateRecommendation(comparison)
    };
}

/**
 * Get candidates by ATS score tiers
 */
export async function getCandidatesByTier(job_id)
{
    const [excellent]=await query(
        `SELECT COUNT(*) as count, AVG(overall_score) as avg_score
         FROM ats_scores WHERE job_id = ? AND overall_score >= 80`,
        [job_id]
    );

    const [good]=await query(
        `SELECT COUNT(*) as count, AVG(overall_score) as avg_score
         FROM ats_scores WHERE job_id = ? AND overall_score >= 65 AND overall_score < 80`,
        [job_id]
    );

    const [moderate]=await query(
        `SELECT COUNT(*) as count, AVG(overall_score) as avg_score
         FROM ats_scores WHERE job_id = ? AND overall_score >= 50 AND overall_score < 65`,
        [job_id]
    );

    const [below]=await query(
        `SELECT COUNT(*) as count, AVG(overall_score) as avg_score
         FROM ats_scores WHERE job_id = ? AND overall_score < 50`,
        [job_id]
    );

    return {
        tiers: {
            highly_recommended: {
                count: excellent[0]?.count||0,
                avg_score: Math.round(excellent[0]?.avg_score||0),
                min_score: 80
            },
            recommended: {
                count: good[0]?.count||0,
                avg_score: Math.round(good[0]?.avg_score||0),
                min_score: 65
            },
            consider: {
                count: moderate[0]?.count||0,
                avg_score: Math.round(moderate[0]?.avg_score||0),
                min_score: 50
            },
            below_threshold: {
                count: below[0]?.count||0,
                avg_score: Math.round(below[0]?.avg_score||0),
                max_score: 50
            }
        },
        total: (excellent[0]?.count||0)+(good[0]?.count||0)+
            (moderate[0]?.count||0)+(below[0]?.count||0)
    };
}

/**
 * Search candidates globally
 */
export async function searchCandidates(searchTerm, options={})
{
    const {limit=20, include_inactive=false}=options;

    let sql=`
        SELECT 
            u.id as user_id,
            u.username,
            u.email,
            u.experience_years,
            u.skills,
            cr.extracted_skills_json,
            cr.experience_years as resume_experience
        FROM users u
        LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
        WHERE u.role = 'candidate'
    `;

    if (!include_inactive)
    {
        sql+=` AND u.is_active = TRUE`;
    }

    sql+=`
        AND (
            u.username LIKE ? OR
            u.email LIKE ? OR
            u.skills LIKE ? OR
            cr.extracted_skills_json LIKE ? OR
            cr.parsed_data_json LIKE ?
        )
        ORDER BY u.username
        LIMIT ?
    `;

    const searchPattern=`%${searchTerm}%`;
    const candidates=await query(sql, [
        searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, limit
    ]);

    return candidates.map(c => ({
        ...c,
        skills: c.skills? JSON.parse(c.skills):[],
        extracted_skills: c.extracted_skills_json? JSON.parse(c.extracted_skills_json):[]
    }));
}

/**
 * Helper: Generate match summary
 */
function generateMatchSummary(resume, jobSkills, breakdown)
{
    if (!resume||!breakdown)
    {
        return 'Insufficient data for analysis';
    }

    const score=breakdown?.skills_match||0;
    if (score>=80) return 'Excellent match - meets most requirements';
    if (score>=65) return 'Good match - meets key requirements';
    if (score>=50) return 'Moderate match - some skill gaps';
    return 'Below threshold - significant gaps';
}

/**
 * Helper: Calculate average
 */
function calculateAverage(numbers)
{
    if (!numbers.length) return 0;
    return Math.round(numbers.reduce((a, b) => a+b, 0)/numbers.length);
}

/**
 * Helper: Calculate skill coverage
 */
function calculateSkillCoverage(candidates, jobSkills)
{
    const requiredSkills=jobSkills.required||[];
    if (!requiredSkills.length) return {covered: 0, total: 0, percentage: 100};

    const allMatchedSkills=new Set();
    candidates.forEach(c =>
    {
        c.skills.forEach(skill =>
        {
            if (requiredSkills.some(rs =>
                skill.toLowerCase().includes(rs.toLowerCase())||
                rs.toLowerCase().includes(skill.toLowerCase())
            ))
            {
                allMatchedSkills.add(skill.toLowerCase());
            }
        });
    });

    return {
        covered: allMatchedSkills.size,
        total: requiredSkills.length,
        percentage: Math.round((allMatchedSkills.size/requiredSkills.length)*100)
    };
}

/**
 * Helper: Generate recommendation
 */
function generateRecommendation(candidates)
{
    if (!candidates.length) return null;

    // Score each candidate
    const scored=candidates.map(c => ({
        user_id: c.user_id,
        username: c.username,
        total_score: (
            (c.metrics.ats_score*0.4)+
            (Math.min(c.metrics.experience_years*10, 100)*0.2)+
            (Math.min(c.metrics.coding_problems_solved*5, 100)*0.2)+
            ((c.metrics.interview_rating||0)*20*0.2)
        )
    }));

    scored.sort((a, b) => b.total_score-a.total_score);

    return {
        recommended: scored[0],
        reason: `Highest combined score based on ATS match, experience, coding ability, and interview performance.`
    };
}

export default {
    filterCandidates,
    getTopCandidates,
    compareCandidates,
    getCandidatesByTier,
    searchCandidates
};
