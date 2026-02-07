/**
 * Results Storage Service
 * Handles storage and retrieval of all assessment, interview, and coding results
 */

import {query, transaction, db} from '../db/database.js';

/**
 * Store assessment results
 */
export async function storeAssessmentResult(data)
{
    const {
        assessment_id,
        candidate_user_id,
        job_id,
        score,
        max_score,
        time_taken_seconds,
        answers,
        proctoring_summary,
        ai_detection_summary
    }=data;

    return await transaction(async (conn) =>
    {
        // Update assessment status and score
        await conn.execute(
            `UPDATE assessments 
             SET status = 'completed', 
                 score = ?, 
                 max_score = ?,
                 completed_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [score, max_score, assessment_id]
        );

        // Store detailed results
        const [result]=await conn.execute(
            `INSERT INTO assessment_results 
             (assessment_id, candidate_user_id, job_id, score, max_score, 
              percentage, time_taken_seconds, answers_json, 
              proctoring_summary_json, ai_detection_summary_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                assessment_id,
                candidate_user_id,
                job_id,
                score,
                max_score,
                max_score>0? (score/max_score)*100:0,
                time_taken_seconds,
                JSON.stringify(answers||[]),
                JSON.stringify(proctoring_summary||{}),
                JSON.stringify(ai_detection_summary||{})
            ]
        );

        // Create notification
        await db.createNotification(
            candidate_user_id,
            'result_available',
            'Assessment Completed',
            'Your assessment results are now available.',
            `/assessments/${assessment_id}/results`
        );

        return result.insertId;
    });
}

/**
 * Store interview results
 */
export async function storeInterviewResult(data)
{
    const {
        interview_id,
        candidate_user_id,
        interviewer_user_id,
        overall_rating,
        technical_rating,
        communication_rating,
        problem_solving_rating,
        cultural_fit_rating,
        feedback,
        strengths,
        weaknesses,
        recommendation,
        transcript,
        ai_analysis
    }=data;

    return await transaction(async (conn) =>
    {
        // Update interview status
        await conn.execute(
            `UPDATE interviews 
             SET status = 'completed',
                 ended_at = NOW(),
                 rating = ?,
                 feedback = ?,
                 transcript = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [overall_rating, feedback, transcript, interview_id]
        );

        // Store detailed interview results
        const [result]=await conn.execute(
            `INSERT INTO interview_results 
             (interview_id, candidate_user_id, interviewer_user_id,
              overall_rating, technical_rating, communication_rating,
              problem_solving_rating, cultural_fit_rating,
              feedback, strengths_json, weaknesses_json,
              recommendation, ai_analysis_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                interview_id,
                candidate_user_id,
                interviewer_user_id,
                overall_rating,
                technical_rating,
                communication_rating,
                problem_solving_rating,
                cultural_fit_rating,
                feedback,
                JSON.stringify(strengths||[]),
                JSON.stringify(weaknesses||[]),
                recommendation,
                JSON.stringify(ai_analysis||{})
            ]
        );

        // Create notification
        await db.createNotification(
            candidate_user_id,
            'result_available',
            'Interview Completed',
            'Your interview evaluation is complete.',
            `/interviews/${interview_id}/results`
        );

        return result.insertId;
    });
}

/**
 * Store coding submission results
 */
export async function storeCodingResult(data)
{
    const {
        session_id,
        problem_id,
        user_id,
        language,
        code,
        status,
        execution_time_ms,
        memory_used_kb,
        test_cases_passed,
        test_cases_total,
        output,
        error_message,
        ai_feedback
    }=data;

    const [result]=await query(
        `INSERT INTO coding_submissions 
         (session_id, problem_id, user_id, language, code, status,
          execution_time_ms, memory_used_kb, test_cases_passed, 
          test_cases_total, output, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            session_id,
            problem_id,
            user_id,
            language,
            code,
            status,
            execution_time_ms,
            memory_used_kb,
            test_cases_passed,
            test_cases_total,
            output,
            error_message
        ]
    );

    // Store AI feedback if provided
    if (ai_feedback)
    {
        await query(
            `INSERT INTO code_analysis 
             (submission_id, user_id, analysis_type, feedback_json)
             VALUES (?, ?, 'ai_review', ?)`,
            [result.insertId, user_id, JSON.stringify(ai_feedback)]
        );
    }

    return result.insertId;
}

/**
 * Store resume and ATS score
 */
export async function storeResumeResult(data)
{
    const {
        user_id,
        job_id,
        filename,
        original_name,
        parsed_data,
        ats_score,
        ats_breakdown,
        matched_skills,
        missing_skills,
        recommendations
    }=data;

    return await transaction(async (conn) =>
    {
        // Update user's resume info
        await conn.execute(
            `UPDATE users 
             SET resume_filename = ?,
                 resume_original_name = ?,
                 resume_uploaded_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [filename, original_name, user_id]
        );

        // Store parsed resume data
        await conn.execute(
            `INSERT INTO candidate_resumes 
             (user_id, filename, original_name, parsed_data_json, 
              extracted_skills_json, experience_years)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                filename = VALUES(filename),
                original_name = VALUES(original_name),
                parsed_data_json = VALUES(parsed_data_json),
                extracted_skills_json = VALUES(extracted_skills_json),
                experience_years = VALUES(experience_years),
                updated_at = NOW()`,
            [
                user_id,
                filename,
                original_name,
                JSON.stringify(parsed_data),
                JSON.stringify(parsed_data?.skills?.technical||[]),
                parsed_data?.total_experience_years||0
            ]
        );

        // Store ATS score for specific job if provided
        if (job_id)
        {
            await conn.execute(
                `INSERT INTO ats_scores 
                 (user_id, job_id, overall_score, breakdown_json, 
                  matched_skills_json, missing_skills_json, recommendations_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    overall_score = VALUES(overall_score),
                    breakdown_json = VALUES(breakdown_json),
                    matched_skills_json = VALUES(matched_skills_json),
                    missing_skills_json = VALUES(missing_skills_json),
                    recommendations_json = VALUES(recommendations_json),
                    calculated_at = NOW()`,
                [
                    user_id,
                    job_id,
                    ats_score,
                    JSON.stringify(ats_breakdown),
                    JSON.stringify(matched_skills),
                    JSON.stringify(missing_skills),
                    JSON.stringify(recommendations)
                ]
            );
        }

        return {success: true};
    });
}

/**
 * Store candidate report
 */
export async function storeCandidateReport(data)
{
    const {
        candidate_user_id,
        assessment_id,
        interview_id,
        job_id,
        overall_score,
        technical_score,
        communication_score,
        problem_solving_score,
        code_quality_score,
        strengths,
        weaknesses,
        recommendations,
        report_data
    }=data;

    const [result]=await query(
        `INSERT INTO candidate_reports 
         (candidate_user_id, assessment_id, interview_id, job_id,
          overall_score, technical_score, communication_score,
          problem_solving_score, code_quality_score,
          strengths, weaknesses, recommendations, report_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            candidate_user_id,
            assessment_id,
            interview_id,
            job_id,
            overall_score,
            technical_score,
            communication_score,
            problem_solving_score,
            code_quality_score,
            JSON.stringify(strengths||[]),
            JSON.stringify(weaknesses||[]),
            recommendations,
            JSON.stringify(report_data||{})
        ]
    );

    // Notify candidate
    if (candidate_user_id)
    {
        await db.createNotification(
            candidate_user_id,
            'result_available',
            'Complete Report Available',
            'Your comprehensive assessment report is ready.',
            `/reports/${result.insertId}`
        );
    }

    return result.insertId;
}

/**
 * Get all results for a candidate
 */
export async function getCandidateResults(user_id)
{
    const [assessments]=await query(
        `SELECT ar.*, a.assessment_type, j.title as job_title, c.name as company_name
         FROM assessment_results ar
         JOIN assessments a ON ar.assessment_id = a.id
         LEFT JOIN jobs j ON ar.job_id = j.id
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE ar.candidate_user_id = ?
         ORDER BY ar.created_at DESC`,
        [user_id]
    );

    const [interviews]=await query(
        `SELECT ir.*, i.interview_type, j.title as job_title, c.name as company_name
         FROM interview_results ir
         JOIN interviews i ON ir.interview_id = i.id
         LEFT JOIN assessments a ON i.assessment_id = a.id
         LEFT JOIN jobs j ON a.job_id = j.id
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE ir.candidate_user_id = ?
         ORDER BY ir.created_at DESC`,
        [user_id]
    );

    const [coding]=await query(
        `SELECT cs.*, COUNT(csub.id) as submissions_count,
                MAX(csub.test_cases_passed) as best_score
         FROM coding_sessions cs
         LEFT JOIN coding_submissions csub ON cs.id = csub.session_id
         WHERE cs.user_id = ?
         GROUP BY cs.id
         ORDER BY cs.started_at DESC`,
        [user_id]
    );

    const [reports]=await query(
        `SELECT cr.*, j.title as job_title, c.name as company_name
         FROM candidate_reports cr
         LEFT JOIN jobs j ON cr.job_id = j.id
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE cr.candidate_user_id = ?
         ORDER BY cr.generated_at DESC`,
        [user_id]
    );

    return {
        assessments,
        interviews,
        coding_sessions: coding,
        reports,
        summary: {
            total_assessments: assessments.length,
            total_interviews: interviews.length,
            total_coding_sessions: coding.length,
            average_score: calculateAverageScore([...assessments, ...interviews])
        }
    };
}

/**
 * Get results for a specific job application
 */
export async function getApplicationResults(application_id)
{
    const [application]=await query(
        `SELECT app.*, 
                u.username, u.email, u.resume_filename,
                j.title as job_title, j.skills_json as job_skills,
                c.name as company_name
         FROM applications app
         JOIN users u ON app.candidate_user_id = u.id
         JOIN jobs j ON app.job_id = j.id
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE app.id = ?`,
        [application_id]
    );

    if (!application.length)
    {
        return null;
    }

    const app=application[0];

    const [assessments]=await query(
        `SELECT * FROM assessments 
         WHERE application_id = ? OR 
               (candidate_user_id = ? AND job_id = ?)
         ORDER BY created_at DESC`,
        [application_id, app.candidate_user_id, app.job_id]
    );

    const [atsScore]=await query(
        `SELECT * FROM ats_scores
         WHERE user_id = ? AND job_id = ?
         ORDER BY calculated_at DESC LIMIT 1`,
        [app.candidate_user_id, app.job_id]
    );

    return {
        application: app,
        assessments,
        ats_score: atsScore[0]||null
    };
}

/**
 * Helper function to calculate average score
 */
function calculateAverageScore(results)
{
    if (!results.length) return 0;

    const scores=results
        .filter(r => r.score!==null&&r.max_score!==null&&r.max_score>0)
        .map(r => (r.score/r.max_score)*100);

    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a+b, 0)/scores.length);
}

export default {
    storeAssessmentResult,
    storeInterviewResult,
    storeCodingResult,
    storeResumeResult,
    storeCandidateReport,
    getCandidateResults,
    getApplicationResults
};
