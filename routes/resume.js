/**
 * Resume Routes
 * Handles resume upload, parsing, and ATS scoring
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import {fileURLToPath} from 'url';
import {query} from '../db/database.js';
import {extractResumeText, parseResume, calculateATSScore, generateDetailedAnalysis} from '../services/resumeParser.js';
import {storeResumeResult} from '../services/resultsStorage.js';

const router=express.Router();
const __dirname=path.dirname(fileURLToPath(import.meta.url));

// Configure multer for resume uploads
const storage=multer.diskStorage({
    destination: async function (req, file, cb)
    {
        const uploadDir=path.join(__dirname, '../../uploads/resumes');
        try
        {
            await fs.mkdir(uploadDir, {recursive: true});
        } catch (err)
        {
            // Directory exists
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb)
    {
        const uniqueSuffix=Date.now()+'-'+Math.round(Math.random()*1E9);
        const ext=path.extname(file.originalname);
        cb(null, `resume-${uniqueSuffix}${ext}`);
    }
});

const fileFilter=(req, file, cb) =>
{
    const allowedTypes=[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype))
    {
        cb(null, true);
    } else
    {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
};

const upload=multer({
    storage,
    fileFilter,
    limits: {fileSize: 5*1024*1024} // 5MB limit
});

/**
 * Upload and parse resume
 * POST /api/resume/upload
 */
router.post('/upload', upload.single('resume'), async (req, res) =>
{
    try
    {
        if (!req.file)
        {
            return res.status(400).json({message: 'No resume file uploaded'});
        }

        const {user_id, job_id}=req.body;

        if (!user_id)
        {
            return res.status(400).json({message: 'User ID is required'});
        }

        const filePath=req.file.path;
        const filename=req.file.filename;
        const originalName=req.file.originalname;

        // Extract text from resume
        const resumeText=await extractResumeText(filePath);

        // Parse resume into structured data
        const parsedResume=await parseResume(resumeText);

        // Calculate ATS score if job_id is provided
        let atsResult=null;
        if (job_id)
        {
            const [jobResult]=await query(
                'SELECT * FROM jobs WHERE id = ?',
                [job_id]
            );

            if (jobResult.length>0)
            {
                const job=jobResult[0];
                const jobSkills=job.skills_json? JSON.parse(job.skills_json):{};

                const jobRequirements={
                    required_skills: jobSkills.required||[],
                    preferred_skills: jobSkills.preferred||[],
                    min_experience_years: job.experience_required||0,
                    required_education: job.requirements||'',
                    keywords: jobSkills.keywords||[],
                    title: job.title,
                    description: job.description
                };

                atsResult=calculateATSScore(parsedResume, jobRequirements);
            }
        }

        // Store resume result
        await storeResumeResult({
            user_id,
            job_id,
            filename,
            original_name: originalName,
            parsed_data: parsedResume,
            ats_score: atsResult?.overall_score||null,
            ats_breakdown: atsResult?.breakdown||null,
            matched_skills: atsResult?.matched_skills||[],
            missing_skills: atsResult?.missing_skills||[],
            recommendations: atsResult?.recommendations||[]
        });

        res.json({
            success: true,
            message: 'Resume uploaded and parsed successfully',
            data: {
                filename,
                original_name: originalName,
                parsed_resume: parsedResume,
                ats_score: atsResult
            }
        });
    } catch (error)
    {
        console.error('Resume upload error:', error);
        res.status(500).json({message: 'Failed to process resume', error: error.message});
    }
});

/**
 * Get resume info for a user
 * GET /api/resume/:user_id
 */
router.get('/:user_id', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;

        const results=await query(
            `SELECT cr.*, u.resume_filename, u.resume_original_name, u.resume_uploaded_at
             FROM users u
             LEFT JOIN candidate_resumes cr ON u.id = cr.user_id
             WHERE u.id = ?`,
            [user_id]
        );

        if (!results.length||!results[0].resume_filename)
        {
            return res.json({resume: null});
        }

        const resume=results[0];
        res.json({
            resume: {
                filename: resume.filename||resume.resume_filename,
                original_name: resume.original_name||resume.resume_original_name,
                uploaded_at: resume.uploaded_at||resume.resume_uploaded_at,
                parsed_data: resume.parsed_data_json? JSON.parse(resume.parsed_data_json):null,
                extracted_skills: resume.extracted_skills_json? JSON.parse(resume.extracted_skills_json):[],
                experience_years: resume.experience_years
            }
        });
    } catch (error)
    {
        console.error('Get resume error:', error);
        res.status(500).json({message: 'Failed to fetch resume', error: error.message});
    }
});

/**
 * Calculate ATS score for a resume against a job
 * POST /api/resume/ats-score
 */
router.post('/ats-score', async (req, res) =>
{
    try
    {
        const {user_id, job_id}=req.body;

        if (!user_id||!job_id)
        {
            return res.status(400).json({message: 'User ID and Job ID are required'});
        }

        // Get user's resume
        const [resumeResult]=await query(
            'SELECT parsed_data_json FROM candidate_resumes WHERE user_id = ?',
            [user_id]
        );

        if (!resumeResult.length||!resumeResult[0].parsed_data_json)
        {
            return res.status(404).json({message: 'Resume not found for user'});
        }

        const parsedResume=JSON.parse(resumeResult[0].parsed_data_json);

        // Get job requirements
        const [jobResult]=await query(
            'SELECT * FROM jobs WHERE id = ?',
            [job_id]
        );

        if (!jobResult.length)
        {
            return res.status(404).json({message: 'Job not found'});
        }

        const job=jobResult[0];
        const jobSkills=job.skills_json? JSON.parse(job.skills_json):{};

        const jobRequirements={
            required_skills: jobSkills.required||[],
            preferred_skills: jobSkills.preferred||[],
            min_experience_years: job.experience_required||0,
            required_education: job.requirements||'',
            keywords: jobSkills.keywords||[],
            title: job.title,
            description: job.description
        };

        // Calculate ATS score
        const atsResult=calculateATSScore(parsedResume, jobRequirements);

        // Store the score
        await query(
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
                atsResult.overall_score,
                JSON.stringify(atsResult.breakdown),
                JSON.stringify(atsResult.matched_skills),
                JSON.stringify(atsResult.missing_skills),
                JSON.stringify(atsResult.recommendations)
            ]
        );

        res.json({
            success: true,
            ats_score: atsResult
        });
    } catch (error)
    {
        console.error('ATS score calculation error:', error);
        res.status(500).json({message: 'Failed to calculate ATS score', error: error.message});
    }
});

/**
 * Get detailed AI analysis of resume for a job
 * POST /api/resume/analyze
 */
router.post('/analyze', async (req, res) =>
{
    try
    {
        const {user_id, job_id}=req.body;

        if (!user_id||!job_id)
        {
            return res.status(400).json({message: 'User ID and Job ID are required'});
        }

        // Get user's resume
        const [resumeResult]=await query(
            'SELECT parsed_data_json FROM candidate_resumes WHERE user_id = ?',
            [user_id]
        );

        if (!resumeResult.length)
        {
            return res.status(404).json({message: 'Resume not found'});
        }

        const parsedResume=JSON.parse(resumeResult[0].parsed_data_json);

        // Get job requirements
        const [jobResult]=await query(
            'SELECT * FROM jobs WHERE id = ?',
            [job_id]
        );

        if (!jobResult.length)
        {
            return res.status(404).json({message: 'Job not found'});
        }

        const job=jobResult[0];
        const jobSkills=job.skills_json? JSON.parse(job.skills_json):{};

        const jobRequirements={
            title: job.title,
            required_skills: jobSkills.required||[],
            preferred_skills: jobSkills.preferred||[],
            min_experience_years: job.experience_required||0,
            required_education: job.requirements||'',
            description: job.description
        };

        // Get detailed AI analysis
        const analysis=await generateDetailedAnalysis(parsedResume, jobRequirements);

        res.json({
            success: true,
            analysis
        });
    } catch (error)
    {
        console.error('Resume analysis error:', error);
        res.status(500).json({message: 'Failed to analyze resume', error: error.message});
    }
});

/**
 * Delete resume
 * DELETE /api/resume/:user_id
 */
router.delete('/:user_id', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;

        // Get current resume filename
        const [result]=await query(
            'SELECT resume_filename FROM users WHERE id = ?',
            [user_id]
        );

        if (result.length&&result[0].resume_filename)
        {
            // Delete file
            const filePath=path.join(__dirname, '../../uploads/resumes', result[0].resume_filename);
            try
            {
                await fs.unlink(filePath);
            } catch (e)
            {
                // File might not exist
            }
        }

        // Clear database records
        await query(
            `UPDATE users 
             SET resume_filename = NULL, 
                 resume_original_name = NULL, 
                 resume_uploaded_at = NULL 
             WHERE id = ?`,
            [user_id]
        );

        await query('DELETE FROM candidate_resumes WHERE user_id = ?', [user_id]);
        await query('DELETE FROM ats_scores WHERE user_id = ?', [user_id]);

        res.json({success: true, message: 'Resume deleted successfully'});
    } catch (error)
    {
        console.error('Delete resume error:', error);
        res.status(500).json({message: 'Failed to delete resume', error: error.message});
    }
});

/**
 * Download resume file
 * GET /api/resume/:user_id/download
 */
router.get('/:user_id/download', async (req, res) =>
{
    try
    {
        const {user_id}=req.params;

        const results=await query(
            'SELECT resume_filename, resume_original_name FROM users WHERE id = ?',
            [user_id]
        );

        if (!results.length||!results[0].resume_filename)
        {
            return res.status(404).json({message: 'Resume not found'});
        }

        const {resume_filename, resume_original_name}=results[0];
        const filePath=path.join(__dirname, '../../uploads/resumes', resume_filename);

        try
        {
            await fs.access(filePath);
            res.download(filePath, resume_original_name||resume_filename);
        } catch (e)
        {
            res.status(404).json({message: 'Resume file not found'});
        }
    } catch (error)
    {
        console.error('Download resume error:', error);
        res.status(500).json({message: 'Failed to download resume', error: error.message});
    }
});

export default router;
